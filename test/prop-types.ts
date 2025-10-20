import { c, Host } from "atomico";

/**
 * Component testing various prop types
 */
export const PropTypesComponent = c(
    ({
        stringProp,
        numberProp,
        boolProp,
        arrayProp,
        objectProp,
        customAttr
    }): Host<{
        onDataChange: CustomEvent<any>;
        reset: () => void;
    }> => <host>Testing</host>,
    {
        props: {
            /**
             * String property
             */
            stringProp: String,
            /**
             * Number property
             */
            numberProp: Number,
            /**
             * Boolean property
             */
            boolProp: Boolean,
            /**
             * Array property
             */
            arrayProp: Array,
            /**
             * Object property
             */
            objectProp: Object,
            /**
             * Property with custom attribute name
             */
            customAttr: {
                type: String,
                attr: "data-custom",
            },
        },
    }
);

customElements.define("prop-types", PropTypesComponent);
