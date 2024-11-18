
const RouteGroupBuilder = function() {

    let $groups = [];

    this.addGroup = function(group) {
        $groups.push(group);
    };

    this.removeGroup = function(group) {
        $groups = $groups.filter((groupItem) => group !== groupItem);
    };

    this.getName = function(name) {
        const names = [];
        $groups.forEach((group) => {
            const name = group.getName();
            if(name) {
                names.push(name);
            }
         });
        if(name) {
            names.push(name);
        }
        return names.join('');
    };

    this.getPath = function(path) {
        const prefixes = [];
        $groups.forEach((group) => {
            const prefix = group.getPrefix();
            if(prefix) {
                prefixes.push(prefix);
            }
        });
        if(path) {
            prefixes.push(path);
        }
        return prefixes.join('/');
    };

    this.getMiddlewares = function(middlewares) {
        let allMiddlewares = [];
        $groups.forEach((group) => {
            const groupMiddlewares = group.getMiddlewares();
            if(groupMiddlewares) {
                allMiddlewares = allMiddlewares.concat(groupMiddlewares);
            }
        });
        if(middlewares) {
            allMiddlewares = allMiddlewares.concat(middlewares);
        }
        return allMiddlewares;
    };

};

export default RouteGroupBuilder;