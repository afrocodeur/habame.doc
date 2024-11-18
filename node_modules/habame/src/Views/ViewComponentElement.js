import AbstractView from "src/Views/AbstractView";
import Template from "src/Template/Template";
import ComponentProps from "src/Component/ComponentProps";
import ActionTemplate from "src/Template/ActionTemplate";
import ViewElementFragment from "src/Views/ViewElementFragment";
import ViewComponentElementDev from "./Dev/ViewComponentElementDev";

/**
 *
 * @param {Object} $viewDescription
 * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} $viewProps
 *
 * @class
 * @extends AbstractView
 */
const ViewComponentElement = function($viewDescription, $viewProps) {

    AbstractView.call(this, { $viewDescription, $viewProps });

    const $viewAnchor = document.createComment('');

    /** @type {?Component} */
    let $componentElement = null;

    /** @type {?ComponentProps} */
    let $componentProps = null;
    /** @type {?HbEvent} */
    let $hbEvent = null;
    /** @type {Object.<string, {template: ActionTemplate, callback: Function, name: string}>} */
    let $componentEventActions = {};
    /** @type {Object.<string, { builder: function(*, *): ViewElementFragment, updateViewDescription: Function, deleteInstances: Function }>} */
    let $slotManagers = {};

    const build = function() {
        const props = {};
        if($viewDescription.props) {
            for(const propName in $viewDescription.props) {
                props[propName] = new Template($viewDescription.props[propName], $viewProps);
            }
        }
        $componentProps = new ComponentProps(props, getSlots());
        $componentElement = $viewProps.appInstance.createComponentByName($viewDescription.component, $componentProps);
        buildEventListenerWithParent();
    };

    /**
     * @param {Object} viewDescription
     * @returns {{ builder: function(*, *): ViewElementFragment, updateViewDescription: Function, deleteInstances: Function }}
     */
    const getSlotManagerObject = function(viewDescription) {
        /** @type {ViewElementFragment[]} */
        const instances = [];
        return {
            updateViewDescription: function(newViewDescription) {
                viewDescription = newViewDescription;
                instances.forEach((node) => {
                    node.updateViewDescription(newViewDescription);
                });
            },
            deleteInstances: function() {
                instances.forEach((node)=> {
                    node.remove();
                });
            },
            builder: function(container, callback) {
                const localState = callback(viewDescription.props);
                const customProps = { ...$viewProps };
                if(localState) {
                    localState.parent = $viewProps.getStateToUse();
                    customProps.localState = localState;
                }
                const node = new ViewElementFragment(viewDescription, customProps);
                node.render(container);
                instances.push(node);
                return node;
            }
        };
    };

    const getSlots = function() {
        const slots = { };
        if($viewDescription.content) {
            const slotManager = getSlotManagerObject($viewDescription.content);
            slots.default = slotManager.builder;
            $slotManagers.default = slotManager;
        }
        if(!$viewDescription.slots) {
            return slots;
        }

        for(const name in $viewDescription.slots) {
            const slotManager = getSlotManagerObject($viewDescription.slots[name]);
            $slotManagers[name] = slotManager;
            slots[name]= slotManager.builder;
        }
        return slots;
    };

    const buildEventListenerWithParent = () => {
        const componentActions = $viewProps.componentInstance.getActions();
        if(!$viewDescription.events || !componentActions) {
            return;
        }
        $hbEvent = $componentElement.getHbEvent();

        for(const eventName in $viewDescription.events) {
            const actionName = $viewDescription.events[eventName];
            buildEvent(eventName, actionName);
        }
    };

    /**
     * @param {string} eventName
     * @param {string} actionName
     */
    const buildEvent = function(eventName, actionName) {
        const actionTemplate = new ActionTemplate(actionName, $viewProps);
        const callback = function() {
            const params = Array.from(arguments);
            params.push($viewProps.localState);
            actionTemplate.handle(null, params);
        };
        $componentEventActions[eventName] = { template: actionTemplate, callback, name: eventName };
        $hbEvent.addEventListener(eventName, callback);
    };

    /**
     * @param {HTMLElement|DocumentFragment} parentNode
     * @param {ViewIfStatement} ifStatement
     */
    this.renderProcess = function(parentNode, ifStatement) {
        build();
        parentNode.appendChild($viewAnchor);
        if(ifStatement && ifStatement.isFalse()) {
            return;
        }
        $componentElement.render(parentNode);
    };

    /**
     * @param {boolean} full
     */
    this.unmountProcess = function(full) {
        if(full) {
            this.unmountAnchors($viewAnchor.parentNode, $viewAnchor);
            if(!$componentElement) {
                return;
            }
        }
        $componentElement.unmount(full);
        this.setIsUnmounted();
    };

    /**
     * @param {ViewIfStatement} ifStatement
     */
    this.mountProcess = function(ifStatement) {
        this.mountAnchors();
        if(ifStatement && ifStatement.isFalse()) {
            return;
        }
        if($componentElement.isRendered()) {
            $componentElement.mount();
        }
        else {
            const fragment = document.createDocumentFragment();
            $componentElement.render(fragment);
            this.insertAfter(fragment, $viewAnchor);
        }
        this.setIsMounted();
    };

    this.removeProcess = function() {
        $viewAnchor.remove();
        $componentElement.remove();
        this.setIsUnmounted();
    };

    this.target = function() {
        if(!$componentElement) {
            return null;
        }
        return $componentElement.getPublicMethod();
    };


    ViewComponentElementDev.apply(this, [{
        $viewDescription,
        $viewProps,
        $componentEventActions,
        $slotManagers,
        $callbacks: {
            getProps: () => $componentProps,
            getElement: () => $componentElement,
            getHbEvent: () => $hbEvent,
            getSlots,
            buildEvent,
            getSlotManagerObject
        }
    }]);
};

export default ViewComponentElement;