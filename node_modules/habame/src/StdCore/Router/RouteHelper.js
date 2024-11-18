
const RouteHelper =  {

    cleanPath: function(path) {
        if(path === undefined || path === null) {
            return null;
        }
        return path.replace(/^[/]+/, '').replace(/[/]+$/, '').replace(/[/]+/g, '/').trim();
    }

};

export default RouteHelper;