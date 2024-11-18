/**
 * @class
 */
const BrowserHistory = function() {

    this.push = function(historyItem) {
        const route = historyItem.route;
        history.pushState({ ...route.getState(), uuid: historyItem.uuid }, '', route.getUrl());
    };

    this.back = function() {
        history.back();
    };

    this.forward = function() {
        history.forward();
    };

    this.getCurrentLocation = function() {
        const pathname = location.pathname.replace(/\+$/, '')
            .replace(/^\+/, '');
        return pathname + location.search;
    };

    this.useService = function(routerService) {
        window.addEventListener("popstate", (event) => {
            if(!event.state || !event.state.uuid) {
                return;
            }
            routerService.moveTo(event.state.uuid);
        });
    };

};

export default BrowserHistory;