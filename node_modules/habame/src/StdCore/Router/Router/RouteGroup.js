
const RouteGroup = function($router) {

    const $routeGroupOptions = {
        prefix: null,
        name: null,
        middlewares: []
    };

    this.prefix = function(prefix) {
        $routeGroupOptions.prefix = prefix;
        return this;
    };

    this.name = function(name) {
        $routeGroupOptions.name = name;
        return this;
    };

    this.middlewares = function() {
        $routeGroupOptions.middlewares = Array.from(arguments);
        return this;
    };

    this.getName = function() {
        return $routeGroupOptions.name;
    };

    this.getPrefix = function() {
        return $routeGroupOptions.prefix;
    };

    this.getMiddlewares = function() {
        return $routeGroupOptions.middlewares;
    };

    this.group = function(callback) {
        $router.groups().addGroup(this);
        callback();
        $router.groups().removeGroup(this);
    };

};

export default RouteGroup;