## Habame

`Habame` is a frontend javascript framework to build user interface


### Create a component


```js

const App = Habame.createComponent('App', function() {
    // Define your component states, actions, event and others here
}, `<div>Welcome to Habame</div>`);

```


### Render a component
```js
const root = Habame.createRoot(document.getElementById('app'));
root.render(App);
// or
root.render('App'); 
```


### Create an action and call it

```js

const App = Habame.createComponent('App', function({ Actions }) {

    Actions.callMeWithEvent = function($event) {
        alert('Hello '+ $event.target.getAttribute('name') +'!');
    };

    Actions.callMeWithValue = function(name) {
        alert('Hello '+ name +' !');
    };
},
`
    <div>
        <div><button events.click="callMeWithEvent" name = "Afeinclan" >Call me!</button></div>
        <br/>
        <div><button events.click="callMeWithValue($event.target.getAttribute('name'))" name = "PrinceMo" >Hey dude!</button></div>
        <br/>
        <div><button events.click="callMeWithEvent($event)" name = "Sarkodie" >Finish here!</button></div>
    </div>
`);
```

### Create and update state in component


```js

const App = Habame.createComponent('App', function({ State, Actions }) {
    State.init({ value: 0, square: 0 });

    Actions.setValue = function(event) {
        State.value = Number(event.target.value);
        State.square = State.value * State.value;
    };
}, 
`
    <div>
        <div>
            <input type="number" events.input="setValue" />
        </div>
        <br/>
        <div>The square of {{ value }} is {{ square }}</div>
    </div>
`);

```

### Work with props
by default props are send to component but it doesn't affect the component state

```js
const App = Habame.createComponent('App', function({ State, Actions }) {
    State.init({ nbClick: 0 });

    Actions.clickMe = function() {
        State.nbClick++;
    }
},
`
    <div>
        <NbClick props.count = "nbClick" />
        <button events.click = "clickMe" >Click</button>
    </div>
`);


const root = Habame.createRoot(document.getElementById('app'));
root.render(App);
```

- In this case, count will empty and will never update
```js
    Habame.createComponent('NbClick', function() {}, `<div >You click {{ count }} time.s</div>`);
```

- Will show the first value captured, but will never update the state when the props will be update
```js 
    Habame.createComponent('NbClick', function({ State, Props }) {
        State.add('count', Props.count);
    }, `<div >You click {{ count }} time.s</div>`);
```

- Chose the moment you want to update your component state
```js 
    Habame.createComponent('NbClick', function({ State, Props }) {
        State.add('count', Props.count);
        Props.onUpdate('count', (value) => {
            if(value % 2 === 0) {
                State.count = value;
            }
        });

    }, `<div >You click {{ count }} time.s</div>`);
```

-  Full Synchronisation with props, will automatically add and update your state when the props will be updated
```js
    Habame.createComponent('NbClick', function({ State, Props }) {
        State.useProps(Props);
        // State.useProps(Props, ['count']); // chose only props to synchronise automatically
    }, `<div >You click {{ count }} time.s</div>`);
```


### Events
use HbEvent to make a communication between parent and child component 

```js
Habame.createComponent('CustomCountButton', function({ HbEvent, Actions }) {

    const onClick = HbEvent.create('onClick');

    Actions.emitTheClick = function() {
        onClick.emit();
    };

},
`
    <button events.click="emitTheClick" >Click me!</button>
`);

const App = Habame.createComponent('App', function({ State, Actions }) {

    State.init({
        count: 0
    });

    Actions.eventFromChild = function() {
        State.count++;
    };

},
`
    <div>
        {{ count }} nb click
        <br/><br/>
        <CustomCountButton events.onClick="eventFromChild" />
    </div>
`);
```

### Element Reference

Reference will allow you to get element from view (html element or component)

- get html element
```js

const App = Habame.createComponent('App', function({ State, Actions, Refs }) {
    State.init({ value: 0, square: 0 });

    Actions.calculate = function() {
        const target = Refs.input.target();
        State.value = Number(target.value);
        State.square = State.value * State.value;
    };
},
`
    <div>
        <div>
            <input type="number" ref="input" /> <button events.click="calculate">Calculate</button>
        </div>
        <br/>
        <div>The square of {{ value }} is {{ square }}</div>
    </div>
`);

```
- get component
In this case, you could call the public function of component if available

```js 
Habame.createComponent('SwitchButton', function({ State }) {

    State.init({ isOn: false });

    return { // public functions for parent component
        toggle: () => {
            State.isOn = !State.isOn;
        }
    };
},
`
    <div >{{ isOn ? 'Button is on' : 'Button is off' }}</div>
`);

const App = Habame.createComponent('App', function({ Actions, Refs }) {

    Actions.togglePlayer = function() {
        const switchButton = Refs.switchButton.target();
        switchButton.toggle();
    };

},
`
    <div>
        <SwitchButton ref="switchButton" />
        <br/>
        <div>
            <button events.click = 'togglePlayer' >Toggle</button>
        </div>
    </div>
`);
```

- collection of ref
 collection of ref work only for loop context, `ref` and `repeat` must be define the same tag

```js
const App = Habame.createComponent('App', function({ Actions, Refs }) {

    Actions.togglePlayer = function() {
        Refs.switchButton.each((button) => {
            button.target().toggle();
        });
    };

},
`
    <div>
        <SwitchButton ref="switchButton" repeat="element in 1..3" />
        <br/>
        <div>
            <button events.click = 'togglePlayer' >Toggle</button>
        </div>
    </div>
`);
```

### Work with Loop 
- use repeat with `in` or `as` `Start..NbElements`
```js
const App = Habame.createComponent('App', function() {},
`
    <div>
        <div repeat="index in 5..3" >
            the index is {{ index }}
        </div>
        <br/>
        <div repeat="index, value in 5..3" >
            the value at  {{ index }} is {{ value}}
        </div>
        <br/>
        <div repeat="5..3 as (index, value)" >
            the value at  {{ index }} is {{ value}}
        </div>
        <br/>
        <div repeat="5..3 as value" >
            the value at  {{ index }} is {{ value}} <!-- index will be automatically available -->
        </div>
    </div>
`);
```

- use repeat with `in` or `as` and `iterable`
  - `index in iterable`
  - `(index, value) in iterable`
  - `iterable as value`
  - `iterable as (index, value)`

```js
const App = Habame.createComponent('App', function({ State, Actions, Refs }) {
    State.add('products', []);

    Actions.addProduct = function() {
        const target = Refs.input.target();
        State.products.push(target.value);
        target.value = '';
        target.focus();
    };
},
`
    <div>
        <ul>
            <li repeat="products as product" >
                {{ product }}
            </li>
        </ul>
        <br/>
        <input type="text" ref="input" /> <button events.click = "addProduct" >Add +</button>
    </div>
`);
```

### If control structure
will allow you to easly show or display component or html element

```js
const App = Habame.createComponent('App', function({ State, Actions }) {
    State.add('pill', '');

    Actions.chosePill = function($event) {
        State.pill = $event.target.value;
    };

},
`
    <div>
        <div>Chose your pill</div>
        <div>
            <label >
                <input type="radio" name="pill" value="blue" events.change="chosePill" />
                <span>Blue</span>
            </label>
            <label >
                <input type="radio" name="pill" value="red" events.change="chosePill"  />
                <span>Red</span>
            </label>
            <div if="pill === 'red'">Welcome into the matrix</div>
            <div elseif="pill === 'blue'">Welcome into the reality</div>
            <div else="" >You have to do your choice</div>
        </div>
    </div>
`);
```

### Create a service

```js
Habame.createService('ProductService', function(State) {
    State.add('productList', []);

    this.addProduct = function(name, price) {
        State.productList.push({ name, price });
    };

}, { isUniqueInstance: true }); // use isUniqueInstance to share the same instance of service among applicaton component

Habame.createComponent('ProductForm', function({ Actions, Refs }) {
    const productService = Habame.Services.ProductService;

    Actions.addProduct = function() {
        const nameInput = Refs.name.target();
        const priceInput = Refs.price.target();
        productService.addProduct(nameInput.value, priceInput.value);
        nameInput.value = '';
        priceInput.value = '';
        nameInput.focus();
    };
},
`
    <input type="text" ref="name" placeholder="Name" />  <input type="text" ref="price" placeholder="Price" /> <button events.click = "addProduct" >Add +</button>
`);

const App = Habame.createComponent('App', function({ State }) {
    State.useService(Habame.Services.productService); // will sync your component state with all service states
    // State.useService(Habame.Services.productService, ['productList']); // will sync your component state with only required service states
},
`
<div>
    <ul>
        <li repeat="productList as product" >
            {{ product.name }} <strong>{{ product.price}}$</strong>
        </li>
    </ul>
    <br/>
    <ProductForm />
</div>
`);
```

### Create a directive
```js
Habame.createDirective('validator', function({ element, attribute, attrs }) {
    const errorContainer = document.createElement('div');

    element.addEventListener('input', function() {
        const isCorrectValue = (new RegExp(attribute.value())).test(element.value);
        errorContainer.innerHTML = isCorrectValue ? '' : 'Error';
    });

    this.created = function() {
        const nextElement = element.nextSibling;
        if(nextElement) {
            element.parentNode.insertBefore(errorContainer, nextElement);
            return;
        }
        element.parentNode.appendChild(errorContainer);
    };

});

const App = Habame.createComponent('App', function() { },
`
<div>
    <form events.prevent.submit="" >
        <input type="text" directives.validator="'[0-9]+'}}" />
    </form>
</div>
`);
```

### create a view engine

Some time we repeat the same code to display, present or do something. In case you don't want to create a component
you could just add a view engine to add or edit something specific before the view compilation.

**Note :** `the view engine is only an interpret, nothing more `

```js
Habame.addViewEngine('formInput', function(sourceCode) {
    return sourceCode.replace(/@formTextInput/ig, '<input type="text" class="my-custom-form-input" placeholder="Simple text" />')
        .replace(/@formPasswordInput\b/ig, '<input type="password" class="my-custom-form-input" placeholder="Password" />');
});

const App = Habame.createComponent('App', function() { },
`
    <form>
        <div>@formTextInput</div>
        <br/>
        <div>@formPasswordInput</div>
    </form>
`, { engines: ['formInput']});


const root = Habame.createRoot(document.getElementById('app'));
root.render(App);
```

### Create a model with mutators
this will allow you to create model to manage your data and make it compatible with state, only methods define as mutators will be overridden.

```js
const User = function () {

    this.lastname = '';
    this.firstname = '';

    this.setFullName = (firstname, lastname) => {
        this.lastname = lastname;
        this.firstname = firstname;
    };
};

User.prototype.MUTATORS = ['setFullName'];


const App = Habame.createComponent('App', function({ State, Actions }) {

    State.add('user', new User());

    Actions.changeToJhon = function() {
        State.user.setFullName('Jhon', 'do');
    };


},
`
 <div if="user.lastname" >hello {{ user.lastname }} {{ user.firstname }}</div>
 <button events.click = 'changeToJhon' >Change to Jhon do</button>
`);
```


### Use App to make communication between component
`App` is the instance of you rootApp which contain his own event handler and state handler

```js
Habame.createComponent('MyComponent', function({ App }) {
    
    const appEvent = App.getEvent(); // will return the app HbEvent
    const state = App.getState(); // will return the app State
    
}, ``);
```

example with app event

```js
Habame.createComponent('Notifications', function({ App, State }) {

    State.init({ notifications: [] });

    App.getEvent().addEventListener('push-notification', function(notification) {
        State.notifications.push(notification);

        setTimeout(() => {
            State.notifications.shift();
        }, 3000);
    });

},
`
    <div class="notifications-container" >
        <div class="notification-container" repeat="notifications as notification" >
            {{ notification.message }}
        </div>
    </div>
`);


const App = Habame.createComponent('App', function({ App, State, Actions }) {

    State.init({
        count: 0
    });
    let countNotifications = 0;

    Actions.sendNotification = function() {
        App.getEvent().emit('push-notification', [{ message: 'Add new notification ' + (++countNotifications) }]);
    };

},
`
    <div>
        <Notifications />
        <br/><br/>
        <button events.click="sendNotification" >Send notification</button>
    </div>
`);
```