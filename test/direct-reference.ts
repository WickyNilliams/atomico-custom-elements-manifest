import { c } from "atomico";
import { commonProps } from "./shared-props";

/**
 * Component using direct prop reference
 * @fires custom-click - Emitted when clicked
 * @csspart button - The button part
 */
export const DirectRefComponent = c(
    ({ id, label }) => <host><button part="button">{label}</button></host>,
    {
        props: commonProps,
    }
);

customElements.define("direct-ref", DirectRefComponent);
