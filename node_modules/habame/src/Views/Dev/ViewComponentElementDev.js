import Template from "../../Template/Template";

/**
 * @param {Object} arg
 * @param {Object} arg.$viewDescription
 * @param {Object.<string, {template: ActionTemplate, callback: Function, name: string}>} arg.$componentEventActions
 * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} arg.$viewProps
 * @param {Object.<string, ?{ builder: function(*, *): ViewElementFragment, updateViewDescription: Function, deleteInstances: Function }>} arg.$slotManagers
 * @param {{getProps: Function, getHbEvent: Function, buildEvent: Function}} arg.$callbacks
 *
 * @class
 */
const ViewComponentElementDev = function({ $viewDescription, $componentEventActions, $viewProps, $slotManagers, $callbacks  }) {

    const { getProps, getElement, getHbEvent, buildEvent, getSlotManagerObject } = $callbacks;

    /**
     * @param {Object.<string, string>} props
     */
    const buildProps = function(props) {
        const componentProps = getProps();
        if(!componentProps) {
            return;
        }

        Object.keys($viewDescription.props).forEach((name) => {
            if(!props[name]) {
                const template = componentProps.getTemplate(name);
                if(template) {
                    template.disconnect();
                }
            }
        });

        const componentState = getElement().getState();
        const propsToRefresh = [];
        for(const propName in props) {
            if(componentProps.exists(propName)) {
                propsToRefresh.push(propName);
                continue;
            }
            const template = new Template(props[propName], $viewProps);
            componentProps.add(propName, template);
            componentState.useProps(componentProps, [propName]);
        }
        propsToRefresh.forEach(function(propName) {
            componentProps.getTemplate(propName).refresh(props[propName], true);
        });
    };

    /**
     * @param {Object.<string, string>} events
     */
    const buildEvents = function(events) {
        const hbEvent = getHbEvent();
        if(!hbEvent) {
            return;
        }

        Object.keys($viewDescription.events).forEach((eventName) => {
            const event = $componentEventActions[eventName];
            if(!events[eventName]) {
                hbEvent.removeEventListener(event.name, event.callback);
                return;
            }
            event.template.refresh(events[eventName]);
        });

        for(const eventName in events) {
            if($componentEventActions[eventName]) {
                continue;
            }
            const actionName = events[eventName];
            buildEvent(eventName, actionName);
        }
    };

    const updatePropsSlots = function() {
        const componentProps = getProps();
        if(!componentProps) {
            return;
        }
        const slotBuilders = {};
        Object.keys($slotManagers).forEach(() => {
            if(!$slotManagers[name]) {
                return;
            }
            slotBuilders[name] = $slotManagers[name].builder;
        });
        componentProps.updateSlots(slotBuilders);
    };


    /**
     * @param {Object} template
     */
    const updateSlots = function(template) {
        if(!template.content && !template.slots) {
            Object.keys($slotManagers).forEach((name) => {
                $slotManagers[name].deleteInstances();
                $slotManagers[name] = null;
            });
            return;
        }

        if($viewDescription.slots) {
            Object.keys($viewDescription.slots).forEach((name) => {
                if(!template.slots || !template.slots[name]) {
                    $slotManagers[name].deleteInstances();
                    $slotManagers[name] = null;
                    return;
                }
                $slotManagers[name].updateViewDescription(template.slots[name]);
            });
        }

        if(template.content) {
            if($viewDescription.content) {
                $slotManagers.default.updateViewDescription(template.content);
            }
            else {
                $slotManagers.default = getSlotManagerObject(template.content);
            }
        }
        else if($viewDescription.content) {
            $slotManagers.default.deleteInstances();
            $slotManagers.default = null;
        }

        Object.keys(template.slots).forEach((name) => {
            if($viewDescription.slots[name]) {
                return;
            }
            $slotManagers[name] = getSlotManagerObject(template[name]);
        });

    };


    /**
     * @param {Object} template
     */
    this.updateViewDescription = function(template) {
        buildProps(template.props);
        buildEvents(template.events);
        updateSlots(template);
        updatePropsSlots();

        const propertiesToUpdated = ['content', 'slots', 'events', 'props'];

        propertiesToUpdated.forEach((property) => {
            $viewDescription[property] = template[property];
        });
    };

};

export default ViewComponentElementDev;