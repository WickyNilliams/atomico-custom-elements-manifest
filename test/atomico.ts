import { c, Host, html, css } from "atomico";

/**
 * Description of my component
 * @cssprop {color} --text-color - description of my custom property
 * @slot default - default slot content
 * @csspart button - the button part
 * @fires custom-event - fires when something happens
 */
const MyComponent = c(({ age, value }: { 
    /**
     * description of my age prop
     */
    age: number, 
    /**
     * description of my value prop
     */
    value: string[] 
}): Host<{
    /**
     * description of my custom event
     */
    onMyEvent: CustomEvent<string>;
    /**
     * description of another event
     */
    onValueChange: CustomEvent<string[]>;
}> => {
    return html`<host shadowDom />`;
}, {
    props: { 
        age: Number, 
        value: {
            type: Array,
            /**
             * description of my event from props
             */
            event: {
                type: "MyEvent",
            },
        }
    },
    styles: css`
        :host {
            --custom-prop: red;
            font-size: 2rem;
        }
    `
});

// Test case 2: Simpler component with just props
const SimpleComponent = c(({ message }: { message: string }) => {
    return html`<host>${message}</host>`;
}, {
    props: { message: String }
});

// Test case 3: Component with destructured props (no explicit typing)
const DestructuredComponent = c(({ title, count }) => {
    return html`<host>${title}: ${count}</host>`;
}, {
    props: { 
        title: String, 
        count: Number 
    }
});

// Test case 4: Component with complex prop definitions
const ComplexComponent = c(({ items, enabled }: { 
    items: string[], 
    enabled: boolean 
}) => {
    return html`<host />`;
}, {
    props: {
        items: {
            type: Array,
            attr: "data-items",
            event: {
                type: "ItemsChanged",
                base: "CustomEvent"
            }
        },
        enabled: {
            type: Boolean,
            value: true,
        }
    }
});

// Test case 5: Component with only events, no props
const EventOnlyComponent = c((): Host<{
    onReady: CustomEvent<void>;
    onError: CustomEvent<Error>;
}> => {
    return html`<host />`;
});

export { MyComponent, SimpleComponent, DestructuredComponent, ComplexComponent, EventOnlyComponent };

// Custom elements definitions
customElements.define("my-component", MyComponent);
customElements.define("simple-component", SimpleComponent);
customElements.define("destructured-component", DestructuredComponent);
customElements.define("complex-component", ComplexComponent);
customElements.define("event-only-component", EventOnlyComponent);
