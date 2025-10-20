import { c } from "atomico";

/**
 * Description of my component
 * @cssprop {color} --text-color - description of my custom property
 */
export const Component = c(
    ({ age, value }) => <host />,
    {
        props: {
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
