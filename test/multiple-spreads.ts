import { c } from "atomico";
import { commonProps, styleProps } from "./shared-props";

/**
 * Component using multiple spread props
 * @slot default - Default content slot
 */
export const MultiSpreadComponent = c(
    ({ id, label, className, style, active }) => <host>{label}</host>,
    {
        props: {
            ...commonProps,
            ...styleProps,
            /**
             * Whether the component is active
             */
            active: Boolean,
        },
    }
);

customElements.define("multi-spread", MultiSpreadComponent);
