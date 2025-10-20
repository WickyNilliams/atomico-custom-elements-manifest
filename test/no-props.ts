import { c, Host } from "atomico";

/**
 * Component with no props, only events and methods
 * @slot content - Main content area
 */
export const NoPropsComponent = c(
    (): Host<{
        onReady: Event;
        onClick: MouseEvent;
        show: () => void;
        hide: () => void;
    }> => <host><div>Static content</div></host>,
    {}
);

customElements.define("no-props", NoPropsComponent);
