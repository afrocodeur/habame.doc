import HbEvent from "src/Event/HbEvent";
import State from "src/State/State";
import ComponentProps from "src/Component/ComponentProps";
import ComponentFactory from "src/Component/ComponentFactory";

/**
 * @param {HTMLElement} htmlNodeElement
 * @param {Habame} HabameCore
 *
 * @class
 */
const App = function(htmlNodeElement, HabameCore) {

    const $event = new HbEvent();
    const $state = new State();

    /**
     * @param {ComponentFactory} componentFactory
     * @param {ComponentProps} props
     *
     * @returns {Component}
     */
    const createComponentInstance = (componentFactory, props) => {
        return componentFactory.create(props, this, HabameCore);
    };

    /**
     * @param {string} name
     * @param {Array} params
     *
     * @returns {*}
     */
    this.createDirectiveInstance = function(name, params) {
        const directiveFactory = HabameCore.getDirectiveFactory(name);
        return directiveFactory.create(params);
    };

    /**
     * @param {ComponentFactory|string} source
     * @param {?ComponentProps} props
     *
     * @returns {Component}
     */
    this.createComponentByName = function(source, props) {
        const componentFactory = (source instanceof ComponentFactory) ? source : window.Habame.getComponentFactory(source);
        props = props || new ComponentProps();
        return createComponentInstance(componentFactory, props);
    };

    this.getEvent = function() {
        return $event;
    };

    this.getState = function() {
        return $state;
    };

    /**
     * @param {string} name
     * @returns {?App}
     */
    this.getApp = function(name) {
        return HabameCore.getApp(name);
    };

    /**
     * @param {ComponentFactory|string} componentFactory
     *
     * @returns {Component}
     */
    this.render = function(componentFactory) {
        const instance = (typeof componentFactory === 'string')
            ? this.createComponentByName(componentFactory, null)
            :createComponentInstance(componentFactory, null);
        instance.render(htmlNodeElement);
        return instance;
    };
};
export default App;