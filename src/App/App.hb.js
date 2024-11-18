
function App({ State }) {

    State.init({
       appName: 'HabameDoc'
    });

}

export default {
    name: 'App',
    controller: App,
    templateUrl: 'app.template.html',
    styleUrl: 'app.scss'
};