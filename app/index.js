'use strict';
var util = require('util');
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var yeoman = require('yeoman-generator');
var yosay = require('yosay');
var chalk = require('chalk');
var wiredep = require('wiredep');
var GitHubApi = require('github');

var githubOptions = {
    version: '3.0.0'
};

var github = new GitHubApi(githubOptions);

if (process.env.GITHUB_TOKEN) {
    github.authenticate({
        type: 'oauth',
        token: process.env.GITHUB_TOKEN
    });
}

var extractGeneratorName = function (_, appname) {
    var slugged = _.slugify(appname);
    var match = slugged.match(/^generator-(.+)/);

    if (match && match.length === 2) {
        return match[1].toLowerCase();
    }

    return slugged;
};

var githubUserInfo = function (name, cb) {
    github.user.getFrom({
        user: name
    }, function (err, res) {
        if (err) {
            throw new Error(err.message +
                '\n\nCannot fetch your github profile. Make sure you\'ve typed it correctly.');
        }
        cb(JSON.parse(JSON.stringify(res)));
    });
};

var KnockoutGulpBootstrapGenerator = yeoman.generators.Base.extend({
    init: function () {
        this.pkg = require('../package.json');
        this.currentYear = (new Date()).getFullYear();

        this.on('end', function () {
            if (!this.options['skip-install']) {
                this.installDependencies();
            }
        });
    },

    askFor: function () {
        var done = this.async();

        // welcome message
        if (!this.options['skip-welcome-message']) {
            this.log(yosay());
            this.log(chalk.magenta('Out of the box I include HTML5 Boilerplate, jQuery, and a gulpfile.js to build your app.'));
        }

        var prompts = [
            {
                name: 'githubUser',
                message: 'Would you mind telling me your username on GitHub?',
                default: 'someuser'
            },
            {
                type: 'checkbox',
                name: 'features',
                message: 'What more would you like?',
                choices: [
                    {
                        name: 'Sass',
                        value: 'includeSass',
                        checked: true
                    },
                    {
                        name: 'Bootstrap',
                        value: 'includeBootstrap',
                        checked: true
                    },
                    {
                        name: 'Modernizr',
                        value: 'includeModernizr',
                        checked: true
                    }
                ]
            }
        ];


        this.prompt(prompts, function (props) {
            var features = props.features;
            var hasFeature = function (feat) {
                return features.indexOf(feat) !== -1;
            }
            this.githubUser = props.githubUser;

            // manually deal with the response, get back and store the results.
            // we change a bit this way of doing to automatically do this in the self.prompt() method.
            this.includeSass = hasFeature('includeSass');
            this.includeBootstrap = hasFeature('includeBootstrap');
            this.includeModernizr = hasFeature('includeModernizr');

            done();
        }.bind(this));
    },

    askForGeneratorName: function () {
        var done = this.async();
        var generatorName = extractGeneratorName(this._, this.appname);

        var prompts = [{
            name: 'generatorName',
            message: 'What\'s the name of your webapp?',
            default: generatorName
        }];

        this.prompt(prompts, function (props) {
//            if (props.pkgName) {
//                return this.askForGeneratorName();
//            }

            this.generatorName = props.generatorName;
            this.appname = this.generatorName;

            done();
        }.bind(this));
    },

    enforceFolderName: function () {
        if (this.appname !== this._.last(this.destinationRoot().split(path.sep))) {
            this.destinationRoot(this.appname);
        }
    },

    userInfo: function () {
        var done = this.async();

        githubUserInfo(this.githubUser, function (res) {
            /*jshint camelcase:false */
            this.realname = res.name;
            this.email = res.email;
            this.githubUrl = res.html_url;
            done();
        }.bind(this));
    },

    bower: function() {
        var bower = {
            name: this._.slugify(this.appname),
            private: true,
            dependencies: {}
        };

        if (this.includeBootstrap) {
            var bs = 'bootstrap' + (this.includeSass ? '-sass-official' : '');
            bower.dependencies[bs] = '~3.2.0';
        } else {
            bower.dependencies.jquery = '~2.1.1';
        }

        if (this.includeModernizr) {
            bower.dependencies.modernizr = '~2.8.1';
        }

        this.copy('bowerrc', '.bowerrc');
        this.write('bower.json', JSON.stringify(bower, null, 2));
    },

    h5bp: function() {
        this.copy('favicon.ico', 'app/favicon.ico');
        this.copy('404.html', 'app/404.html');
        this.copy('robots.txt', 'app/robots.txt');
        this.copy('htaccess', 'app/.htaccess');
    },

    mainStylesheet: function () {
        var css = 'main.' + (this.includeSass ? 's' : '') + 'css';
        this.copy(css, 'app/styles/' + css);
    },

    writeIndex: function () {
        this.indexFile = this.readFileAsString(path.join(this.sourceRoot(), 'index.html'));
        this.indexFile = this.engine(this.indexFile, this);

        // wire Bootstrap plugins
        if (this.includeBootstrap) {
            var bs = '../bower_components/bootstrap' + (this.includeSass ? '-sass-official/assets/javascripts/bootstrap/' : '/js/');
            this.indexFile = this.appendScripts(this.indexFile, 'scripts/plugins.js', [
                    bs + 'affix.js',
                    bs + 'alert.js',
                    bs + 'dropdown.js',
                    bs + 'tooltip.js',
                    bs + 'modal.js',
                    bs + 'transition.js',
                    bs + 'button.js',
                    bs + 'popover.js',
                    bs + 'carousel.js',
                    bs + 'scrollspy.js',
                    bs + 'collapse.js',
                    bs + 'tab.js'
            ]);
        }

        this.indexFile = this.appendFiles({
            html: this.indexFile,
            fileType: 'js',
            optimizedPath: 'scripts/main.js',
            sourceFileList: ['scripts/main.js']
        });
    },

    projectfiles: function () {
        this.copy('editorconfig', '.editorconfig');
        this.copy('jshintrc', '.jshintrc');
    },

    app: function () {
        this.mkdir('app');
        this.mkdir('app/images');
        this.mkdir('app/scripts');
        this.mkdir('app/scripts/models');
        this.mkdir('app/scripts/views');
        this.mkdir('app/scripts/viewmodels');
        this.mkdir('app/styles');
        this.mkdir('app/vendor');
        this.mkdir('app/fonts');
        this.write('app/index.html', this.indexFile);
        //this.write('app/scripts/main.js', 'console.log(\'\\\'Allo \\\'Allo!\');');

        this.copy('_package.json', 'package.json');
        this.copy('_README.md', 'README.md');
        this.copy('gitignore', '.gitignore');
        this.copy('gitattributes', '.gitattributes');
        this.copy('main.js', 'app/scripts/main.js');
        this.copy('config.js', 'app/scripts/config.js');
        this.copy('gulpfile.js', 'gulpfile.js');
    },

    install: function () {
        var howToInstall =
            '\nAfter running `npm install & bower install`, inject your front end dependencies into' +
            '\nyour HTML by running:' +
            '\n' +
            chalk.yellow.bold('\n  gulp wiredep');

        if (this.options['skip-install']) {
            this.log(howToInstall);
            return;
        }

        var done = this.async();
        this.installDependencies({
            skipMessage: this.options['skip-install-message'],
            skipInstall: this.options['skip-install'],
            callback: function () {
                var bowerJson = JSON.parse(fs.readFileSync('./bower.json'));

                // wire Bower packages to .html
                wiredep({
                    bowerJson: bowerJson,
                    directory: 'bower_components',
                    exclude: ['bootstrap-sass'],
                    src: 'app/index.html'
                });

                if (this.includeSass) {
                    // wire Bower packages to .scss
                    wiredep({
                        bowerJson: bowerJson,
                        directory: 'bower_components',
                        src: 'app/styles/*.scss'
                    });
                }

                done();
            }.bind(this)
        });
    }
});

module.exports = KnockoutGulpBootstrapGenerator;
