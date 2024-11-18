/**
 * @param {Habame} Habame
 */
export default function DynamicComponent(Habame) {
    Habame.createComponent('DynamicComponent', function({ State, Props, App, Lifecycle }, $view) {

        const $componentCache = {};
        const $currentComponent = { component: null, name: null };

        State.disconnectProps();
        const build = function() {
            const componentName = Props.use;
            if(!componentName) {
                throw new Error('Props *use* required');
            }
            if($currentComponent.name === componentName) {
                return;
            }
            if($currentComponent.component) {
                $currentComponent.component.unmount();
            }
            if(!$componentCache[componentName]) {
                const component = App.createComponentByName(Props.use, Props);
                const componentView = component.getView();

                const fragment = document.createDocumentFragment();
                component.render(fragment);

                componentView.insertAfter(fragment, $view.getAnchor());
                $componentCache[componentName] = { component, fragment };
            } else {
                $componentCache[componentName].component.mount();
            }
            $currentComponent.component = $componentCache[componentName].component;
            $currentComponent.name = componentName;
        };

        Props.onUpdate('use', build);

        Lifecycle.onCreated(build);

    }, ``);
}