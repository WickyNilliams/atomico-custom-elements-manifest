import { c, Host } from "atomico";
import { baseProps } from "./base-props";

/**
 * Description of my component
 * @cssprop {color} --text-color - description of my custom property
 */
export const Component = c(
    ({ name, id, age, value }): Host<{ onMyCustomEvent: Event; myMethod: () => void }> => <host />,
    {
        props: {
            ...baseProps,
            /**
             * description of my prop
             */
            age: Number,
            /**
             * description of my prop
             */
            value: {
                type: Array,
                /**
                 * description of my event
                 */
                event: {
                    type: "MyEvent",
                },
            },
        },
    }
);

customElements.define("my-wc", Component);
