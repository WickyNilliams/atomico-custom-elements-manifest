import { parseComment } from "@uppercod/jsdoc";

const getComment = (jsDoc) => jsDoc?.find(({ comment }) => comment)?.comment;

/**
 * Extract the type as a string from a TypeScript type node
 */
const getTypeText = (typeNode) => {
    if (!typeNode) return undefined;

    // Simple identifier: Event, CustomEvent, etc.
    if (typeNode.typeName?.escapedText) {
        return typeNode.typeName.escapedText;
    }

    // For generic types like CustomEvent<string>
    if (typeNode.typeName && typeNode.typeArguments) {
        return typeNode.typeName.escapedText;
    }

    return undefined;
};

/**
 * Parse Host generic type parameter to extract events and methods
 * Host<{ onMyEvent: Event, myMethod: () => void }>
 */
const parseHostType = (ts, arrowFunction) => {
    const events = [];
    const methods = [];

    // Check if arrow function has a type annotation
    const typeNode = arrowFunction.type;
    if (!typeNode) return { events, methods };

    // Check if it's a Host type reference
    if (typeNode.kind === ts.SyntaxKind.TypeReference &&
        typeNode.typeName?.escapedText === "Host") {

        // Get the type arguments (the generic parameter)
        const typeArgs = typeNode.typeArguments;
        if (typeArgs && typeArgs.length > 0) {
            const typeLiteral = typeArgs[0];

            // Parse the type literal members
            if (typeLiteral.kind === ts.SyntaxKind.TypeLiteral && typeLiteral.members) {
                typeLiteral.members.forEach((member) => {
                    const memberName = member.name?.escapedText;
                    if (!memberName) return;

                    // Events start with "on"
                    if (memberName.startsWith("on")) {
                        const eventName = memberName.substring(2); // Remove "on" prefix
                        const eventType = getTypeText(member.type);

                        events.push({
                            name: eventName,
                            type: eventType || "Event",
                        });
                    } else {
                        // Everything else is a method
                        methods.push({
                            name: memberName,
                        });
                    }
                });
            }
        }
    }

    return { events, methods };
};

/**
 * Parse a prop definition from the props object
 * Handles both simple types (String, Number) and extended config objects
 */
const parseProp = (propProperty, jsDoc) => {
    const propName = propProperty.name.escapedText;
    const initializer = propProperty.initializer;

    // Simple type: { name: String }
    if (initializer.escapedText) {
        return [
            propName,
            {
                type: initializer.escapedText,
                description: getComment(jsDoc),
            }
        ];
    }

    // Extended config: { name: { type: String, attr: "...", event: {...} } }
    if (initializer.properties) {
        const schema = {
            description: getComment(jsDoc),
        };

        initializer.properties.forEach(({ name, initializer: propInit, jsDoc: propJsDoc }) => {
            const configKey = name.escapedText;

            switch (configKey) {
                case "type":
                case "value":
                case "attr":
                    schema[configKey] = propInit.escapedText;
                    break;
                case "event":
                    schema.event = {
                        base: "CustomEvent",
                        description: getComment(propJsDoc),
                    };
                    propInit.properties?.forEach(({ name, initializer }) => {
                        const eventKey = name.escapedText;
                        if (eventKey === "type" || eventKey === "base") {
                            schema.event[eventKey] = initializer.text || initializer.escapedText;
                        }
                    });
                    break;
            }
        });

        return [propName, schema];
    }

    return null;
};

export default () => ({
    name: 'atomico',
    analyzePhase({ ts, node, context }) {
        switch (node.kind) {
            /**
             * Detect if the module imports `c` from `atomico`
             */
            case ts.SyntaxKind.ImportDeclaration:
                {
                    if (
                        context.imports.some(
                            (imp) =>
                                imp.importPath == "atomico" && imp.name == "c"
                        )
                    ) {
                        context.isAtomico = true;
                        context.components = {};
                    }
                }
                break;
            /**
             * Look for variable declarations using the new c() syntax:
             * const MyComponent = c(({props}) => <host />, { props: {...} })
             */
            case ts.SyntaxKind.VariableDeclaration:
                {
                    if (!context.isAtomico) break;

                    const varName = node?.name?.escapedText;
                    const initializer = node?.initializer;

                    // Check if initializer is a call to `c`
                    if (
                        initializer?.kind === ts.SyntaxKind.CallExpression &&
                        initializer?.expression?.escapedText === "c"
                    ) {
                        const args = initializer.arguments;

                        // First argument is the component function (arrow function or regular function)
                        // Second argument is the config object with props
                        if (args.length >= 1) {
                            const componentFn = args[0];
                            const configArg = args[1];

                            // Extract JSDoc from the variable declaration's parent
                            const jsDoc = node.parent?.parent?.jsDoc
                                ?.map(({ tags, comment }) => [
                                    { comment },
                                    ...(tags?.map(
                                        ({
                                            tagName: { escapedText: tag },
                                            comment,
                                        }) => ({
                                            tag,
                                            comment,
                                        })
                                    ) || []),
                                ])
                                .flat();

                            context.components[varName] = {
                                constructor: varName,
                                jsDoc,
                            };

                            // Parse Host type from arrow function return type
                            if (componentFn?.kind === ts.SyntaxKind.ArrowFunction) {
                                const { events, methods } = parseHostType(ts, componentFn);
                                if (events.length > 0) {
                                    context.components[varName].hostEvents = events;
                                }
                                if (methods.length > 0) {
                                    context.components[varName].hostMethods = methods;
                                }
                            }

                            // Parse props from the config object
                            if (configArg?.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                                configArg.properties?.forEach(({ name, initializer: configValue }) => {
                                    if (name.escapedText === "props" && configValue?.properties) {
                                        context.components[varName].props = configValue.properties
                                            .map((prop) => parseProp(prop, prop.jsDoc))
                                            .filter(Boolean);
                                    }
                                });
                            }
                        }
                    }
                }
                break;
        }
    },
    /**
     * Once analyzed, create the metadata from the collected component information
     */
    moduleLinkPhase({ moduleDoc, context: { isAtomico, components } }) {
        if (!isAtomico) return;

        moduleDoc.declarations = moduleDoc.declarations.map((ref) => {
            for (let componentName in components) {
                const schema = components[componentName];
                if (ref.name == schema.constructor) {
                    const declarations = {
                        slots: [],
                        events: [],
                        members: [],
                        cssParts: [],
                        attributes: [],
                        cssProperties: [],
                    };

                    // Process JSDoc tags for CSS properties, events, slots, etc.
                    if (schema.jsDoc) {
                        schema.jsDoc
                            .filter(({ tag }) => tag)
                            .map(({ tag, comment }) =>
                                parseComment(`@${tag} ${comment}`)
                            )
                            .flat()
                            .forEach(({ tag, type: text, name, children }) => {
                                const type = { text };
                                const description = children?.join("\n");
                                const generic = {
                                    type,
                                    description,
                                    name,
                                };
                                switch (tag) {
                                    case "cssprop":
                                    case "cssproperty":
                                        declarations.cssProperties.push(generic);
                                        break;
                                    case "fires":
                                    case "event":
                                        declarations.events.push(generic);
                                        break;
                                    case "slot":
                                        declarations.slots.push(generic);
                                        break;
                                    case "csspart":
                                        declarations.cssParts.push(generic);
                                        break;
                                }
                            });
                    }

                    // Add events from Host type generic
                    if (schema.hostEvents) {
                        schema.hostEvents.forEach(({ name, type }) => {
                            declarations.events.push({
                                name,
                                type: { text: type },
                            });
                        });
                    }

                    // Add methods from Host type generic
                    if (schema.hostMethods) {
                        schema.hostMethods.forEach(({ name }) => {
                            declarations.members.push({
                                name,
                                kind: "method",
                            });
                        });
                    }

                    // Process props to create members and attributes
                    schema?.props
                        ?.filter(([, propSchema]) => propSchema)
                        .forEach(([name, propSchema]) => {
                            const type = {
                                text: propSchema?.type?.toLowerCase(),
                            };
                            const { description } = propSchema;

                            declarations.members.push({
                                name,
                                type,
                                description,
                            });

                            declarations.attributes.push({
                                name:
                                    propSchema.attr ||
                                    name
                                        .replace(/([A-Z])/g, "-$1")
                                        .toLowerCase(),
                                type,
                                description,
                            });

                            if (propSchema.event) {
                                declarations.events.push({
                                    name: propSchema.event.type,
                                    type: {
                                        text: propSchema.event.base,
                                    },
                                    description: propSchema.event.description,
                                });
                            }
                        });

                    return declarations;
                }
            }
            return ref;
        });
    },
});
