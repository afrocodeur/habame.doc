import ViewDescriptionCompare from "../../Helpers/ViewDescriptionCompare";
import ViewHtmlElementAttribute from "../ViewHtmlElementAttribute";

/**
 * @param {Object} arg
 * @param {Object} arg.$viewDescription
 * @param {Object.<string, ViewHtmlElementAttribute>} arg.$htmlAttributes
 * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} arg.$viewProps
 * @param {Object.<string, {name: string, callback: Function,disconnect: Function, updateAction: Function}>} arg.$htmlEventsStore
 * @param {{getChildren: Function, getHtmlNode: Function, buildEventConnexion: Function}} arg.$callback
 *
 * @class
 */
const ViewHtmlElementDev = function({ $viewDescription, $htmlAttributes, $viewProps, $htmlEventsStore, $callback }) {

    const { getChildren, getHtmlNode, buildEventConnexion } = $callback;


    this.updateAttributes = function(attributes) {
        let newAttributes = {};
        if(attributes) {
            newAttributes = {...attributes};
        }

        Object.keys($htmlAttributes).forEach((attrName) => {
            if(!newAttributes[attrName]) {
                getHtmlNode().removeAttribute(attrName);
                $htmlAttributes[attrName].disconnect();
                return;
            }
            $htmlAttributes[attrName].updateValueSource(newAttributes[attrName]);
        });

        for(const attrName in newAttributes) {
            if($htmlAttributes[attrName]) {
                continue;
            }
            const htmlNode = getHtmlNode();
            if(!htmlNode) {
                continue;
            }
            $htmlAttributes[attrName] = (new ViewHtmlElementAttribute(
                htmlNode,
                attrName,
                newAttributes[attrName],
                $viewProps
            ));
        }
        $viewDescription.attrs = newAttributes;
    };

    this.updateEventHandlers = function(events) {
        let newEvents = {};
        if(events) {
            newEvents = { ...events };
        }
        Object.keys($htmlEventsStore).forEach((eventPath) => {
            if(!newEvents[eventPath]) {
                $htmlEventsStore[eventPath].disconnect();
                return;
            }
            $htmlEventsStore[eventPath].updateAction(newEvents[eventPath]);
        });

        for(const eventPath in events) {
            if($htmlEventsStore[eventPath]) {
                continue;
            }
            buildEventConnexion(eventPath, events);
        }
        $viewDescription.events = events;
    };

    /**
     * @param {Object} viewDescription
     */
    this.updateViewDescription = function(viewDescription) {
        if(ViewDescriptionCompare.html(viewDescription, $viewDescription)) {
            this.updateAttributes(viewDescription.attrs);
            this.updateEventHandlers(viewDescription.events);
            this.updateIfControl(viewDescription.if);
        }
        const children = getChildren();
        if(children) {
            children.updateViewDescription(viewDescription.content);
        }
        $viewDescription.content = viewDescription.content;
    };

};

export default ViewHtmlElementDev;