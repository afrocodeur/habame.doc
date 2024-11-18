import RouteHelper from "StdCore/Router/RouteHelper";

const Route = function($router) {

    const $params =  {
        required: [],
        params: {},
        search: null,
        hash: null,
    };
    const $routerGroupsBuilder = $router.groups();
    const $route = {
        name: '',
        path: null,
        isUniqueInstance: true,
        component: null,
        redirectTo: null,
        middlewares: [],
        where: {}
    };

    const extractParams = function(path, regex) {
        const matches = path.match(regex);
        matches.shift();
        const params = {};
        $params.required.forEach((paramsDetails, index) => {
            params[paramsDetails.name] = matches[index];
        });
        $params.params = params;
    };

    const getParamDefinition = function(param) {
        return { name: param.trim() };
    };
    const getRegexp = function() {
        const regexPattern = $route.path.replace(/\{(.*?)}/g, function(fullValue, paramDefinition) {
            const paramsDetails = getParamDefinition(paramDefinition);
            $params.required.push(paramsDetails);
            if($route.where[paramsDetails.name]) {
                return '(' +$route.where[paramsDetails.name].replace(/\(/g, '(?:') +')';
            }
            return "(.*?)";
        });

        return new RegExp("^"+regexPattern+"$");
    };

    this.params = function() {
        return { ...$params.params };
    };

    this.hash = function() {
        return $params.hash;
    };

    this.query = function() {
        return new URLSearchParams($params.search);
    };

    this.router = function() {
        return $router;
    };

    this.getPath = function() {
        return $route.path;
    };

    this.isUniqueInstance = function() {
        return $params.isUniqueInstance;
    };

    this.getState = function() {
        return {
            params: this.params(),
            query: this.query().toString(),
            hash: this.hash()
        };
    };

    this.path = function(path, component) {
        if(!path && path !== '') {
            throw new Error('Undefined path');
        }
        $route.path = $routerGroupsBuilder.getPath(RouteHelper.cleanPath(path));
        if(!component) {
            return this;
        }
        $route.component = component;
        return this;
    };

    this.name = function(name) {
        $route.name = $routerGroupsBuilder.getName(name);
        $router.setNamedRoute(name, this);
        return this;
    };

    this.dontUseUniqueInstance = function() {
        $route.isUniqueInstance = false;
        return this;
    };

    this.redirectTo = function(redirectTo) {
        $route.redirectTo = redirectTo;
        return this;
    };

    this.middlewares = function() {
        if(arguments.length === 0) {
            throw new Error('Route Middlewares : provide the middlewares names');
        }
        $route.middlewares = $routerGroupsBuilder.getMiddlewares(Array.from(arguments));
        return this;
    };

    this.where = function(where) {
        $route.where = where;
        return this;
    };
    this.isMatch = function(path) {
        if($route.path === null) {
            return false;
        }
        if (path === undefined || path === null) {
            return false;
        }
        const url = new URL(path, location.origin);
        const regex = getRegexp();
        const cleanedPath = RouteHelper.cleanPath(url.pathname);
        if(!regex.test(cleanedPath)) {
            return false;
        }
        $params.search = url.search || null;
        $params.hash = url.hash || null;

        extractParams(cleanedPath, regex);
        return true;
    };

    this.getName = function() {
        return $route.name;
    };

    this.getPath = function() {
        return $route.path;
    };

    this.getMiddlewares = function() {
        return $route.middlewares || [];
    };

    this.getComponent = function() {
        return $route.component;
    };

    this.set = function(params, query, hash) {
        $params.params = params;
        $params.search = query || null;
        $params.hash = hash || null;
    };

    this.getUrl = function(params, query, hash) {
        params = params || $params.params;
        query = query || $params.search;
        hash = hash || $params.hash;

        let url = $route.path.replace(/\{(.*?)}/g, function(fullValue, paramDefinition) {
            const param = getParamDefinition(paramDefinition);
            if(params[param.name] === undefined) {
                throw new Error('Route param required: '+ param.name);
            }
            return encodeURIComponent(params[param.name]);
        });
        if(query) {
            if(typeof query === 'string') {
                url += '?'+ query;
            }
            if(typeof query === 'object') {
                url += '?'+ (new URLSearchParams(query)).toString();
            }
        }
        if(hash) {
            url += '#'+ hash;
        }
        return '/'+ url;
    };

};

export default Route;