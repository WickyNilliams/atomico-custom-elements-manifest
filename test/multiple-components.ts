import { c } from "atomico";

/**
 * First component in file
 */
export const FirstComponent = c(
    ({ title }) => <host>{title}</host>,
    {
        props: {
            /**
             * Component title
             */
            title: String,
        },
    }
);

/**
 * Second component in same file
 * @cssprop {length} --spacing - Controls spacing
 */
export const SecondComponent = c(
    ({ count }) => <host>Count: {count}</host>,
    {
        props: {
            /**
             * Current count
             */
            count: Number,
        },
    }
);

customElements.define("first-comp", FirstComponent);
customElements.define("second-comp", SecondComponent);
