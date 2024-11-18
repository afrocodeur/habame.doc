import Template from "src/Template/Template";

/**
 *
 * @param {string} $ifStatement
 * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} $viewProps
 *
 *  @class
 */
const ViewIfStatement = function($ifStatement, $viewProps) {

    const $ifTemplate = new Template($ifStatement, $viewProps, true);

    /** @type {Function[]} */
    const $listeners = [];

    const trigger = function() {
        $listeners.forEach((callback) => {
            callback.apply(callback, [!!$ifTemplate.value()]);
        });
    };

    /**
     * @param {Function} callback
     *
     * @returns {Function}
     */
    this.watch = function(callback) {
        $listeners.push(callback);
        return callback;
    };

    this.isTrue = function() {
        return !!$ifTemplate.value() === true;
    };

    this.trigger = trigger;

    this.isFalse = function() {
        return !!$ifTemplate.value() === false;
    };

    this.loadStateWatcher = function() {
        const state = $viewProps.getStateToUse();
        const stateToWatchNames = $ifTemplate.statesToWatch();

        state.removeOnUpdateListener(trigger);
        state.onUpdate(stateToWatchNames, trigger, true);
    };

    /**
     * @param {string} template
     */
    this.refresh = function(template) {
        $ifTemplate.refresh(template);
        this.loadStateWatcher();
    };

    ((() => { /* Constructor */
        this.loadStateWatcher();
    })());

};

export default ViewIfStatement;