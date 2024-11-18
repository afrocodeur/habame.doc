import {DEFAULT_SLOT_NAME, SLOT_DEFINITION_TAG_NAME, SLOT_RENDER_TAG_NAME} from "../constantes";


const STRUCT_CONTROL_AND_LOOP_ATTRIBUTES = ['ref', 'if', 'else', 'elseif', 'repeat'];
const FRAGMENT_ACCEPTED_NAMES = ['fragment', 'habame'];

/**
 * @param {string|Document} viewTemplate
 *
 * @returns {Object|string|Array}
 */
const xmlEngine = function(viewTemplate) {

    if(viewTemplate === '') {
        return { content: '' };
    }

    const view = [];
    let parsedDocument = viewTemplate;
    if(!(viewTemplate instanceof Document)) {
        const parser = new DOMParser();
        parsedDocument = parser.parseFromString(`<habame>${viewTemplate}</habame>`, 'application/xhtml+xml');
    }

    const errorNode = parsedDocument.querySelector('parsererror');

    if(!errorNode) {
        return xmlNodeToJson(parsedDocument.activeElement);
    }

    return view;
};

const xmlNodeAttributeDescriptions =  function(nodeElement) {
    if(!nodeElement.getAttributeNames) {
        return {};
    }
    const attributes = { };
    const attributeNames = nodeElement.getAttributeNames();

    attributeNames.forEach(function(attributeName) {
        const attributePath = attributeName.split('.');
        const attributeValue = nodeElement.getAttribute(attributeName);
        if(attributePath.length === 1) {

            if(STRUCT_CONTROL_AND_LOOP_ATTRIBUTES.includes(attributeName.toLowerCase())) {
                attributes[attributeName] = attributeValue;
                return;
            }

            attributes.attrs = attributes.attrs || {};
            attributes.attrs[attributeName] = attributeValue;
            return;
        }
        const attributeType = attributePath.shift();
        const attributeSubName = attributePath.join('.');
        if(!attributes[attributeType]) {
            attributes[attributeType] = {};
        }
        attributes[attributeType][attributeSubName] = attributeValue;
    });

    return attributes;
};
const xmlNodeToJson =  function(nodeElement) {
    const element = {};
    const nodeTagName = nodeElement.tagName;
    if(nodeTagName && !FRAGMENT_ACCEPTED_NAMES.includes(nodeTagName.toLowerCase())) {
        const firstCharOfName = nodeTagName[0];
        if(firstCharOfName === firstCharOfName.toUpperCase()) {
            element.component = nodeTagName;
        }
        else {
            element.name = nodeTagName;
        }
    }

    if(nodeElement.children && nodeElement.children.length > 0) {
        const elementChildren = [];
        const slots = [];
        Array.from(nodeElement.childNodes).forEach((nodeChild) => {
            if(nodeChild instanceof Comment) {
                return;
            }
            const child = xmlNodeToJson(nodeChild);
            if(child.name === SLOT_DEFINITION_TAG_NAME) {
                if(!child.attrs.name) {
                    throw new Error('Slot name is required');
                }
                if(child.props) {
                    child.props = Object.keys(child.props);
                }
                child.name = '';
                slots[child.attrs.name] = child;
                return;
            }
            if(child.name === SLOT_RENDER_TAG_NAME) {
                child.slot = (child.attrs && child.attrs.name) || DEFAULT_SLOT_NAME;
            }
            elementChildren.push(child);
        });
        element.content = elementChildren;
        element.slots = slots;
    }
    else if(nodeElement.textContent) {
        element.content = nodeElement.textContent;
    }
    const attributeDescriptions = xmlNodeAttributeDescriptions(nodeElement);
    if(element.name === undefined && element.component === undefined && Object.keys(attributeDescriptions).length === 0) {
        return element.content;
    }
    for(const key in attributeDescriptions) {
        element[key] = attributeDescriptions[key];
    }
    return element;
};
export default xmlEngine;