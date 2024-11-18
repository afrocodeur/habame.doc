import Route from "StdCore/Router/Router/Route";

/**
 * @param {State} State
 * @param {Router} $router
 * @param {object} $historyHandler
 *
 *
 * @class
 */
const RouterService = function(State, $router, $historyHandler) {

    const $histories = [];
    const $listeners = [];
    let $currentIndex = -1;
    let $currentUrl = null;

    State.init({ $route: null });

    const getHistory = function(index) {
        const historyItem = $histories[index];
        const state = historyItem.state;
        historyItem.route.set(state.params, state.query, state.hash);
        return historyItem;
    };

    const triggerListeners = function (route) {
        $listeners.forEach((listener) => {
            listener(route);
        });
    };

    this.onChange = function(callback) {
        if(typeof callback === 'function') {
            throw new Error('onChange require a function, '+ (typeof callback) +' given');
        }
        $listeners.push(callback);
    };

    this.historyHandler = function() {
        return $historyHandler;
    };

    this.pushRoute = function(route) {
        if(!(route instanceof Route)) {
            return;
        }
        const uuid = (new Date()).getTime();
        const historyItem = { route, state: route.getState(), url: route.getUrl(), uuid };
        $histories.splice($currentIndex + 1);

        $histories.push(historyItem);
        $currentIndex++;

        $historyHandler ? $historyHandler.push(historyItem) : null;
        const isSameRouteButDifferentUrl = State.$route === route && $currentUrl !== historyItem.url;
        State.$route = route;
        $currentUrl = historyItem.url;
        if(isSameRouteButDifferentUrl) {
            State.get('$route').trigger();
        }
        triggerListeners(route);
    };

    this.push = function(route) {
        this.pushRoute($router.get(route));
    };

    this.moveTo = function(uuid) {
        let historyItem = null;
        if($histories[$currentIndex - 1]?.uuid === uuid) {
            $currentIndex--;
            historyItem = $histories[$currentIndex];
        }
        else if($histories[$currentIndex + 1]?.uuid === uuid) {
            $currentIndex++;
            historyItem = $histories[$currentIndex];
        }

        if(historyItem) {
            State.$route = historyItem.route;
        }
    };

    this.back = function() {
        if($currentIndex-1 < 0) {
            return;
        }
        $currentIndex--;
        const historyItem = getHistory($currentIndex);
        $historyHandler ? $historyHandler.back(historyItem.route) : null;
        State.$route = historyItem.route;
    };

    this.forward = function() {
        if(!$histories[$currentIndex + 1]) {
            return;
        }
        $currentIndex++;
        const historyItem = getHistory($currentIndex);
        $historyHandler ? $historyHandler.forward(historyItem.route) : null;
        State.$route = historyItem.route;
    };

};

export default RouterService;