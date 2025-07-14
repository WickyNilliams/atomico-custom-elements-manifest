import { parseComment } from "@uppercod/jsdoc";

const getComment = (jsDoc) => jsDoc?.find(({ comment }) => comment)?.comment;

export default () => ({
    name: 'atomico',
    analyzePhase({ ts, node, context }) {
        switch (node.kind) {
            /**
             * Analyze if the module imports `atomico` and destroy the function `c`
             * in order to determine what is a document created for Atomico
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
             * Analyze the new inline c() syntax:
             * const Component = c(({ prop }) => <host/>, { props: { prop: String } })
             */
            case ts.SyntaxKind.CallExpression:
                {
                    if (!context.isAtomico) break;
                    
                    const callC = node.expression.escapedText;
                    if (callC === "c" && node.arguments?.length >= 1) {
                        const elementName = node.parent?.name?.escapedText;
                        const arrowFunction = node.arguments[0];
                        const configObject = node.arguments[1];
                        
                        if (elementName && arrowFunction) {
                            // Initialize component data
                            context.components[elementName] = {
                                jsDoc: arrowFunction.jsDoc,
                                props: [],
                                events: [],
                                constructor: elementName
                            };
                            
                            // Extract props from arrow function parameters
                            this.extractPropsFromParameters(arrowFunction, context.components[elementName]);
                            
                            // Extract events from Host<> type annotation
                            this.extractEventsFromHostType(arrowFunction, context.components[elementName]);
                            
                            // Extract configuration from second argument
                            if (configObject) {
                                this.extractFromConfigObject(configObject, context.components[elementName]);
                            }
                        }
                    }
                }
                break;
        }
    },
    
    /**
     * Extract prop types from arrow function parameters
     * ({ message, count }: { message: string, count: number }) => ...
     */
    extractPropsFromParameters(arrowFunction, component) {
        const params = arrowFunction.parameters;
        if (!params || params.length === 0) return;
        
        const firstParam = params[0];
        if (firstParam.type && firstParam.type.kind === ts.SyntaxKind.TypeLiteral) {
            // Handle typed parameters: { message: string, count: number }
            firstParam.type.members.forEach(member => {
                if (member.name && member.type) {
                    const propName = member.name.escapedText;
                    const propType = this.getTypeFromTypeNode(member.type);
                    const description = getComment(member.jsDoc);
                    
                    component.props.push([propName, {
                        type: propType,
                        description
                    }]);
                }
            });
        } else if (firstParam.name && firstParam.name.kind === ts.SyntaxKind.ObjectBindingPattern) {
            // Handle destructured parameters: ({ message, count }) => ...
            firstParam.name.elements.forEach(element => {
                if (element.name) {
                    const propName = element.name.escapedText;
                    // Without explicit typing, we'll rely on config object
                    component.props.push([propName, null]);
                }
            });
        }
    },
    
    /**
     * Extract events from Host<{...}> return type annotation
     */
    extractEventsFromHostType(arrowFunction, component) {
        const returnType = arrowFunction.type;
        if (!returnType) return;
        
        // Look for Host<{...}> type reference
        if (returnType.kind === ts.SyntaxKind.TypeReference && 
            returnType.typeName?.escapedText === "Host" &&
            returnType.typeArguments?.length > 0) {
            
            const hostType = returnType.typeArguments[0];
            if (hostType.kind === ts.SyntaxKind.TypeLiteral) {
                hostType.members.forEach(member => {
                    if (member.name && member.type) {
                        const eventName = member.name.escapedText;
                        const eventType = this.getEventTypeFromTypeNode(member.type);
                        const description = getComment(member.jsDoc);
                        
                        component.events.push({
                            name: eventName,
                            type: eventType,
                            description
                        });
                    }
                });
            }
        }
    },
    
    /**
     * Extract configuration from the second argument object
     */
    extractFromConfigObject(configObject, component) {
        if (configObject.kind !== ts.SyntaxKind.ObjectLiteralExpression) return;
        
        configObject.properties.forEach(prop => {
            if (prop.name?.escapedText === "props" && 
                prop.initializer?.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                
                // Process props configuration: { message: String, count: Number }
                prop.initializer.properties.forEach(propDef => {
                    const propName = propDef.name?.escapedText;
                    if (!propName) return;
                    
                    // Find existing prop or create new one
                    let existingProp = component.props.find(([name]) => name === propName);
                    if (!existingProp) {
                        existingProp = [propName, {}];
                        component.props.push(existingProp);
                    }
                    
                    // Update prop schema
                    if (propDef.initializer) {
                        if (propDef.initializer.escapedText) {
                            // Simple type: message: String
                            existingProp[1] = {
                                type: propDef.initializer.escapedText,
                                description: getComment(propDef.jsDoc)
                            };
                        } else if (propDef.initializer.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                            // Complex prop definition
                            const propSchema = this.parseComplexPropDefinition(propDef.initializer, propDef.jsDoc);
                            existingProp[1] = propSchema;
                        }
                    }
                });
            }
        });
    },
    
    /**
     * Parse complex prop definition like: { type: Array, event: { type: "MyEvent" } }
     */
    parseComplexPropDefinition(objectLiteral, jsDoc) {
        const schema = {
            description: getComment(jsDoc)
        };
        
        objectLiteral.properties.forEach(prop => {
            const propName = prop.name?.escapedText;
            
            switch (propName) {
                case "type":
                case "value":
                case "attr":
                    schema[propName] = prop.initializer?.escapedText;
                    break;
                case "event":
                    if (prop.initializer?.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                        schema.event = prop.initializer.properties.reduce((eventSchema, eventProp) => {
                            const eventPropName = eventProp.name?.escapedText;
                            switch (eventPropName) {
                                case "type":
                                case "base":
                                    eventSchema[eventPropName] = eventProp.initializer?.text || eventProp.initializer?.escapedText;
                                    break;
                            }
                            return eventSchema;
                        }, {
                            base: "CustomEvent",
                            description: getComment(jsDoc)
                        });
                    }
                    break;
            }
        });
        
        return schema;
    },
    
    /**
     * Convert TypeScript type node to string representation
     */
    getTypeFromTypeNode(typeNode) {
        switch (typeNode.kind) {
            case ts.SyntaxKind.StringKeyword:
                return "String";
            case ts.SyntaxKind.NumberKeyword:
                return "Number";
            case ts.SyntaxKind.BooleanKeyword:
                return "Boolean";
            case ts.SyntaxKind.ArrayType:
                return "Array";
            case ts.SyntaxKind.TypeReference:
                return typeNode.typeName?.escapedText || "Object";
            default:
                return "Object";
        }
    },
    
    /**
     * Extract event type from CustomEvent<T> type annotation
     */
    getEventTypeFromTypeNode(typeNode) {
        if (typeNode.kind === ts.SyntaxKind.TypeReference && 
            typeNode.typeName?.escapedText === "CustomEvent") {
            return "CustomEvent";
        }
        return "Event";
    },

    /**
     * Once analyzed, the module creates the metadata captured from the document through the context
     */
    moduleLinkPhase({ moduleDoc, context: { isAtomico, components } }) {
        if (!isAtomico) return;
        
        moduleDoc.declarations = moduleDoc.declarations.map((ref) => {
            for (let prop in components) {
                const schema = components[prop];
                if (ref.name === schema.constructor) {
                    const declarations = {
                        slots: [],
                        events: [],
                        members: [],
                        cssParts: [],
                        attributes: [],
                        cssProperties: [],
                    };
                    
                    // Process JSDoc tags (reuse existing logic)
                    if (schema.jsDoc) {
                        schema.jsDoc
                            .filter(({ comment }) => comment)
                            .map(({ comment }) => parseComment(comment))
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
                    
                    // Process props (reuse existing logic)
                    schema.props
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
                    
                    // Process events from Host<> type annotation
                    schema.events?.forEach(({ name, type, description }) => {
                        declarations.events.push({
                            name,
                            type: { text: type },
                            description,
                        });
                    });
                    
                    return declarations;
                }
            }
            return ref;
        });
    },
});
