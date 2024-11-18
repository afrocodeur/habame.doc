/**
 * @class
 */
const MiddlewareHandler = function() {

    let $route = null;
    let $middlewares = [];
    let $currentIndex  = -1;

    const next = function() {
        $currentIndex++;
        if(!$middlewares[$currentIndex]) {
            return;
        }

        const callback = $middlewares[$currentIndex];
        if(typeof callback !== 'function') {
            return;
        }
        callback($route, next);
    };

    this.handle = function(middlewares, route) {
        $route = route;
        $middlewares = middlewares;
        $currentIndex = -1;
        next();
    };

};

export default MiddlewareHandler;