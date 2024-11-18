import State from "src/State/State";
import HbEvent from "src/Event/HbEvent";
import Lifecycle from "src/Component/Lifecycle";
import LifecycleHandler from "src/Component/LifecycleHandler";
import ComponentDev from "./Dev/ComponentDev";
import ComponentProps from "./ComponentProps";

/**
 *
 * @param {string} $name Description - Component name
 * @param {View} $view
 * @param {Function} $controller
 * @param {ComponentProps} $props
 * @param {App} $appInstance
 * @param {Habame} HabameCore
 *
 * @class
 */
const Component = function($name, $view, $controller, $props, $appInstance, HabameCore) {

    /** @type {Object.<string, Function>} */
    const $actions = {};

    const $event = new HbEvent();

    const $state = new State({}, HabameCore);

    const $lifecycleListeners = Lifecycle.newListenersStore();

    const $lifecycle = new Lifecycle($lifecycleListeners);

    const $lifecycleHandler = new LifecycleHandler($lifecycleListeners);

    /** @type {Object.<string, ViewHtmlElement|ViewComponentElement>} */
    const $refs = $view.getReferences();

    /* Allow current component to use the application state */
    $state.parent = $appInstance.getState();
    $state.App = $appInstance.getState();

    if($props instanceof ComponentProps) {
        $state.useProps($props);
    }

    const $componentRequirements = { App: $appInstance, Actions: $actions, HbEvent: $event, State: $state, Props: $props,  Lifecycle: $lifecycle, Refs: $refs };

    const $publicFunctions = $controller($componentRequirements, $view);

    ComponentDev.apply(this, [{ $lifecycle, $event, $componentRequirements , $state }]);

    /**
     * @param {HTMLElement|DocumentFragment} parentNode
     */
    this.render = function(parentNode) {
        $lifecycleHandler.beforeCreate();
        $view.render(parentNode);
        $lifecycleHandler.created();
    };

    this.getView = function() {
        return $view;
    };

    this.isRendered = function() {
        return $view.isRendered();
    };

    /**
     * @param {boolean} full
     */
    this.unmount = function(full) {
        $lifecycleHandler.beforeUnmount();
        $view.unmount(full);
        $lifecycleHandler.unmounted();
    };

    this.mount = function() {
        $lifecycleHandler.beforeMount();
        $view.mount();
        $lifecycleHandler.mounted();
    };

    this.remove = function() {
        // TODO : improve the remove
        $lifecycleHandler.beforeRemove();
        $view.remove();
        $state.disconnect();
        $event.disconnect();
        $lifecycleHandler.removed();
    };

    /**
     * @param {string} name
     *
     * @returns {StateItem}
     */
    this.getStateByName = function(name) {
        return $state.get(name);
    };

    /**
     * @returns {State}
     */
    this.getState = function() {
        return $state;
    };

    /**
     * @returns {string}
     */
    this.getName = function() {
        return $name;
    };

    /**
     * @returns {Object.<string, Function>}
     */
    this.getActions = function() {
        return $actions;
    };

    /**
     * @returns {HbEvent}
     */
    this.getHbEvent = function() {
        return $event;
    };

    /**
     * @param {string} name
     *
     * @returns {?Function}
     */
    this.getSlot = function(name) {
        return $props.getSlot(name);
    };

    /**
     * @returns {Object.<string, Function>}
     */
    this.getPublicMethod = function() {
        return !$publicFunctions ? {} : { ...$publicFunctions };
    };

    ((() => { /* constructor */
        for(const actionName in $actions) {
            $actions[actionName] = $actions[actionName].bind($actions);
        }

        $view.setComponentInstance(this);
    })());
};

export default Component;