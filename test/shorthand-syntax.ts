import { c } from "atomico";
import { commonProps as props } from "./shared-props";

/**
 * Component using shorthand props syntax
 */
export const ShorthandComponent = c(
    ({ id, label }) => <host>{label}</host>,
    { props }
);

customElements.define("shorthand-comp", ShorthandComponent);
