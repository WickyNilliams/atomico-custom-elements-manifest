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

export default () => {
    return {
    name: 'atomico',
    collectPhase({ ts, node, context }) {
        // Initialize storage
        if (!context.propObjectExportsByFile) {
            context.propObjectExportsByFile = {};
        }

        // Track prop objects in the current file being collected
        const sourceFile = node.getSourceFile?.();
        if (!sourceFile) return;

        const fileName = sourceFile.fileName;

        switch (node.kind) {
            /**
             * Collect exported object literals that could be prop definitions
             * e.g., export const baseProps = { name: String, age: Number }
             */
            case ts.SyntaxKind.VariableStatement:
                {
                    // Check if it has export modifier
                    const hasExport = node.modifiers?.some(
                        mod => mod.kind === ts.SyntaxKind.ExportKeyword
                    );

                    if (hasExport && node.declarationList?.declarations) {
                        node.declarationList.declarations.forEach(decl => {
                            const varName = decl.name?.escapedText;
                            const initializer = decl.initializer;

                            // Check if it's an object literal
                            if (initializer?.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                                // Parse props from this object
                                const props = initializer.properties
                                    ?.map(prop => {
                                        // Skip spread elements during collection
                                        if (prop.kind === ts.SyntaxKind.SpreadAssignment) {
                                            return null;
                                        }
                                        return parseProp(prop, prop.jsDoc);
                                    })
                                    .filter(Boolean);

                                if (props && props.length > 0) {
                                    if (!context.propObjectExportsByFile[fileName]) {
                                        context.propObjectExportsByFile[fileName] = {};
                                    }
                                    context.propObjectExportsByFile[fileName][varName] = props;
                                }
                            }
                        });
                    }
                }
                break;
        }
    },
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
                        // Find the config object - it's the last argument that's an ObjectLiteralExpression
                        if (args.length >= 1) {
                            const componentFn = args[0];

                            // Find config object (last ObjectLiteralExpression argument)
                            let configArg = null;
                            for (let i = args.length - 1; i >= 1; i--) {
                                if (args[i].kind === ts.SyntaxKind.ObjectLiteralExpression) {
                                    configArg = args[i];
                                    break;
                                }
                            }

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
                                configArg.properties?.forEach((prop) => {
                                    // Handle shorthand property: { props } instead of { props: props }
                                    if (prop.kind === ts.SyntaxKind.ShorthandPropertyAssignment) {
                                        if (prop.name?.escapedText === "props") {
                                            const identifier = prop.name.escapedText;
                                            const importInfo = context.imports?.find(
                                                imp => imp.name === identifier
                                            );

                                            if (importInfo) {
                                                // For shorthand, we need to find the original export name
                                                // The identifier might be an alias (e.g., import { baseProps as props })
                                                // We need to find the original export name from the import specifier
                                                let exportName = identifier;

                                                // Try to find the import specifier in the AST
                                                const sourceFile = node.getSourceFile?.();
                                                if (sourceFile) {
                                                    sourceFile.forEachChild(child => {
                                                        if (child.kind === ts.SyntaxKind.ImportDeclaration) {
                                                            const importClause = child.importClause;
                                                            if (importClause?.namedBindings?.kind === ts.SyntaxKind.NamedImports) {
                                                                importClause.namedBindings.elements.forEach(specifier => {
                                                                    if (specifier.name?.escapedText === identifier) {
                                                                        // If propertyName exists, it's the original export name
                                                                        // If not, name is both the export and local name
                                                                        exportName = specifier.propertyName?.escapedText || specifier.name.escapedText;
                                                                    }
                                                                });
                                                            }
                                                        }
                                                    });
                                                }

                                                // Store as a direct prop reference
                                                context.components[varName].propReference = {
                                                    identifier: exportName,  // Use the original export name
                                                    importPath: importInfo.importPath,
                                                    isBareModuleSpecifier: importInfo.isBareModuleSpecifier,
                                                };
                                                context.components[varName].props = [];
                                            }
                                        }
                                    }
                                    // Handle regular property assignment
                                    else if (prop.kind === ts.SyntaxKind.PropertyAssignment) {
                                        const { name, initializer: configValue } = prop;

                                        if (name.escapedText === "props") {
                                            // Check if props is a direct reference to an imported object
                                            // e.g., props: sharedProps
                                            if (configValue?.kind === ts.SyntaxKind.Identifier) {
                                                const identifier = configValue.escapedText;
                                                const importInfo = context.imports?.find(
                                                    imp => imp.name === identifier
                                                );

                                                if (importInfo) {
                                                    // Store as a direct prop reference
                                                    context.components[varName].propReference = {
                                                        identifier,
                                                        importPath: importInfo.importPath,
                                                        isBareModuleSpecifier: importInfo.isBareModuleSpecifier,
                                                    };
                                                    context.components[varName].props = [];
                                                }
                                            }
                                            // Check if props is an object literal with properties
                                            else if (configValue?.properties) {
                                                const props = [];
                                                const spreads = [];

                                                configValue.properties.forEach((prop) => {
                                                    // Detect spread elements
                                                    if (prop.kind === ts.SyntaxKind.SpreadAssignment) {
                                                        const spreadIdentifier = prop.expression?.escapedText;

                                                        if (spreadIdentifier) {
                                                            // Find this identifier in imports
                                                            const importInfo = context.imports?.find(
                                                                imp => imp.name === spreadIdentifier
                                                            );

                                                            if (importInfo) {
                                                                spreads.push({
                                                                    identifier: spreadIdentifier,
                                                                    importPath: importInfo.importPath,
                                                                    isBareModuleSpecifier: importInfo.isBareModuleSpecifier,
                                                                });
                                                            }
                                                        }
                                                    } else {
                                                        // Regular prop
                                                        const parsed = parseProp(prop, prop.jsDoc);
                                                        if (parsed) {
                                                            props.push(parsed);
                                                        }
                                                    }
                                                });

                                                context.components[varName].props = props;

                                                if (spreads.length > 0) {
                                                    context.components[varName].propSpreads = spreads;
                                                }
                                            }
                                        }
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
     * Mark which declarations are Atomico components
     * Actual declaration generation happens in packageLinkPhase after spreads are resolved
     */
    moduleLinkPhase({ ts, moduleDoc, context }) {
        // ALWAYS create mapping from relative module path to absolute file path
        // This is needed for ALL modules, not just ones with Atomico components
        if (!context.modulePathMap) {
            context.modulePathMap = {};
        }

        if (!context.propObjectExports) {
            context.propObjectExports = {};
        }

        // Find the source file for this module to get its absolute path
        // We need to iterate through propObjectExportsByFile to find a match
        if (context.propObjectExportsByFile) {
            for (let fileName in context.propObjectExportsByFile) {
                if (fileName.endsWith(moduleDoc.path)) {
                    context.modulePathMap[moduleDoc.path] = fileName;

                    // Also create a normalized prop exports map by relative path
                    context.propObjectExports[moduleDoc.path] = context.propObjectExportsByFile[fileName];
                    break;
                }
            }
        }

        // Only process Atomico components if present
        if (context.isAtomico && context.components) {
            // Store component schemas by module path for packageLinkPhase
            if (!context.componentsByModule) {
                context.componentsByModule = {};
            }
            context.componentsByModule[moduleDoc.path] = context.components;

            // Reset for next module
            context.isAtomico = false;
            context.components = {};
        }
    },

    /**
     * Resolve spreads and generate all component metadata
     */
    packageLinkPhase({ customElementsManifest, context }) {
        if (!context.componentsByModule) return;

        // Helper to resolve import path relative to current module
        const resolveImportPath = (currentModulePath, importPath, isBareModuleSpecifier) => {
            if (isBareModuleSpecifier) {
                // Can't resolve node_modules imports
                return null;
            }

            // Find the module in the manifest that matches this import
            const currentModule = customElementsManifest.modules.find(
                m => m.path === currentModulePath
            );

            if (!currentModule) return null;

            // Simple relative path resolution
            // TODO: Handle more complex cases like ../ and ./
            const basePath = currentModulePath.substring(0, currentModulePath.lastIndexOf('/'));
            const resolvedPath = importPath.startsWith('./')
                ? `${basePath}/${importPath.substring(2)}`
                : importPath;

            // Try to find exact match
            let targetModule = customElementsManifest.modules.find(m => m.path === resolvedPath);

            // Try with .ts extension
            if (!targetModule) {
                targetModule = customElementsManifest.modules.find(m => m.path === `${resolvedPath}.ts`);
            }

            return targetModule?.path || null;
        };

        // First, resolve all prop references and spreads
        for (let modulePath in context.componentsByModule) {
            const components = context.componentsByModule[modulePath];

            for (let componentName in components) {
                const schema = components[componentName];

                // Handle direct prop references (props: sharedProps)
                if (schema.propReference) {
                    const ref = schema.propReference;
                    const targetPath = resolveImportPath(
                        modulePath,
                        ref.importPath,
                        ref.isBareModuleSpecifier
                    );

                    if (targetPath && context.propObjectExports[targetPath]) {
                        const exportedProps = context.propObjectExports[targetPath][ref.identifier];
                        if (exportedProps) {
                            schema.props = [...exportedProps];
                        }
                    }
                }
                // Handle spreads (props: { ...sharedProps, other: String })
                else if (schema.propSpreads && schema.propSpreads.length > 0) {
                    const resolvedProps = [];

                    // Resolve each spread
                    schema.propSpreads.forEach(spread => {
                        const targetPath = resolveImportPath(
                            modulePath,
                            spread.importPath,
                            spread.isBareModuleSpecifier
                        );

                        if (targetPath && context.propObjectExports[targetPath]) {
                            const exportedProps = context.propObjectExports[targetPath][spread.identifier];
                            if (exportedProps) {
                                resolvedProps.push(...exportedProps);
                            }
                        }
                    });

                    // Merge spread props with component props
                    // Spread props come first, then component props can override
                    schema.props = [...resolvedProps, ...(schema.props || [])];
                }
            }
        }

        // Now generate declarations for all modules
        customElementsManifest.modules.forEach(module => {
            const components = context.componentsByModule[module.path];
            if (!components) return;

            module.declarations = module.declarations.map((ref) => {
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
        });
    },
    };
};
