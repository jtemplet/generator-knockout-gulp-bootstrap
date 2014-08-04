define(['toastr'], function (toastr) {
    var debug = true;
    var plugins = {
        router: true,
        widget: true
    };
    // configure toastr settings
    toastr.options.timeOut = 4000;
    toastr.options.positionClass = 'toast-bottom-right';
    toastr.options.backgroundpositionClass = 'toast-bottom-right';
    return {
        debug: debug,
        plugins: plugins
    };
});