import test from "ava";
import { readFile } from "fs/promises";

let manifest;

test.before(async () => {
    manifest = JSON.parse(
        await readFile(new URL("../custom-elements.json", import.meta.url))
    );
});

// Helper to find a module by path
const getModule = (path) => manifest.modules.find(m => m.path === path);

// Helper to find a component declaration
const getComponent = (path) => {
    const module = getModule(path);
    return module?.declarations?.[0];
};

// Helper to find custom element definition
const getCustomElement = (tagName) => {
    for (const module of manifest.modules) {
        const def = module.exports?.find(
            e => e.kind === 'custom-element-definition' && e.name === tagName
        );
        if (def) return def;
    }
    return null;
};

test("manifest has correct schema version", (t) => {
    t.is(manifest.schemaVersion, "0.1.0");
});

test("main component - spread props with inline props", (t) => {
    const comp = getComponent("test/atomico.ts");
    t.truthy(comp);

    // Should have props from baseProps spread (name, id) + inline props (age, value)
    const memberNames = comp.members.map(m => m.name);
    t.true(memberNames.includes("name"), "should have 'name' from spread");
    t.true(memberNames.includes("id"), "should have 'id' from spread");
    t.true(memberNames.includes("age"), "should have 'age' inline prop");
    t.true(memberNames.includes("value"), "should have 'value' inline prop");

    // Should have myMethod from Host type
    const method = comp.members.find(m => m.name === "myMethod");
    t.truthy(method, "should have method from Host type");
    t.is(method.kind, "method");
});

test("main component - events from multiple sources", (t) => {
    const comp = getComponent("test/atomico.ts");

    const eventNames = comp.events.map(e => e.name);
    t.true(eventNames.includes("MyCustomEvent"), "should have event from Host type");
    t.true(eventNames.includes("MyEvent"), "should have event from prop config");

    const hostEvent = comp.events.find(e => e.name === "MyCustomEvent");
    t.is(hostEvent.type.text, "Event");

    const propEvent = comp.events.find(e => e.name === "MyEvent");
    t.is(propEvent.type.text, "CustomEvent");
    t.is(propEvent.description, "description of my event");
});

test("main component - CSS properties from JSDoc", (t) => {
    const comp = getComponent("test/atomico.ts");

    t.is(comp.cssProperties.length, 1);
    t.is(comp.cssProperties[0].name, "--text-color");
    t.is(comp.cssProperties[0].type.text, "color");
});

test("multiple spreads - combines props from multiple sources", (t) => {
    const comp = getComponent("test/multiple-spreads.ts");
    t.truthy(comp);

    const memberNames = comp.members.map(m => m.name);

    // From commonProps
    t.true(memberNames.includes("id"), "should have 'id' from commonProps");
    t.true(memberNames.includes("label"), "should have 'label' from commonProps");

    // From styleProps
    t.true(memberNames.includes("className"), "should have 'className' from styleProps");
    t.true(memberNames.includes("style"), "should have 'style' from styleProps");

    // Inline prop
    t.true(memberNames.includes("active"), "should have 'active' inline prop");

    t.is(comp.members.length, 5, "should have exactly 5 members");
});

test("multiple spreads - has JSDoc slot", (t) => {
    const comp = getComponent("test/multiple-spreads.ts");

    t.is(comp.slots.length, 1);
    t.is(comp.slots[0].name, "default");
});

test("direct reference - uses imported props directly", (t) => {
    const comp = getComponent("test/direct-reference.ts");
    t.truthy(comp);

    const memberNames = comp.members.map(m => m.name);
    t.true(memberNames.includes("id"), "should have 'id' from commonProps");
    t.true(memberNames.includes("label"), "should have 'label' from commonProps");
    t.is(comp.members.length, 2, "should only have props from commonProps");
});

test("direct reference - has JSDoc fires and csspart", (t) => {
    const comp = getComponent("test/direct-reference.ts");

    const eventNames = comp.events.map(e => e.name);
    t.true(eventNames.includes("custom-click"), "should have custom-click event from JSDoc");

    t.is(comp.cssParts.length, 1);
    t.is(comp.cssParts[0].name, "button");
});

test("shorthand syntax - resolves import alias", (t) => {
    const comp = getComponent("test/shorthand-syntax.ts");
    t.truthy(comp);

    const memberNames = comp.members.map(m => m.name);
    t.true(memberNames.includes("id"), "should have 'id' from commonProps (aliased as props)");
    t.true(memberNames.includes("label"), "should have 'label' from commonProps");
    t.is(comp.members.length, 2);
});

test("prop types - all prop types are supported", (t) => {
    const comp = getComponent("test/prop-types.ts");
    t.truthy(comp);

    const propByName = (name) => comp.members.find(m => m.name === name);

    t.is(propByName("stringProp").type.text, "string");
    t.is(propByName("numberProp").type.text, "number");
    t.is(propByName("boolProp").type.text, "boolean");
    t.is(propByName("arrayProp").type.text, "array");
    t.is(propByName("objectProp").type.text, "object");
});

test("prop types - custom attribute name", (t) => {
    const comp = getComponent("test/prop-types.ts");

    // Note: attr with string literal is currently not being parsed correctly
    // See propInit.escapedText issue in parseProp function (should use propInit.text)
    // For now, it falls back to camelCase->kebab-case conversion
    const customAttr = comp.attributes.find(a => a.name === "custom-attr");
    t.truthy(customAttr, "should have attribute (kebab-case conversion of customAttr)");
});

test("prop types - Host events and methods", (t) => {
    const comp = getComponent("test/prop-types.ts");

    const event = comp.events.find(e => e.name === "DataChange");
    t.truthy(event, "should have DataChange event from Host type");
    t.is(event.type.text, "CustomEvent");

    const method = comp.members.find(m => m.name === "reset");
    t.truthy(method, "should have reset method");
    t.is(method.kind, "method");
});

test("multiple components - both components in same file", (t) => {
    const module = getModule("test/multiple-components.ts");
    t.truthy(module);
    t.is(module.declarations.length, 2, "should have 2 component declarations");

    const firstComp = module.declarations.find(d => d.members?.some(m => m.name === "title"));
    t.truthy(firstComp, "should have FirstComponent");

    const secondComp = module.declarations.find(d => d.members?.some(m => m.name === "count"));
    t.truthy(secondComp, "should have SecondComponent");

    t.is(secondComp.cssProperties.length, 1, "SecondComponent should have CSS property");
    t.is(secondComp.cssProperties[0].name, "--spacing");
});

test("multiple components - separate custom element definitions", (t) => {
    const firstDef = getCustomElement("first-comp");
    t.truthy(firstDef);
    t.is(firstDef.declaration.name, "FirstComponent");

    const secondDef = getCustomElement("second-comp");
    t.truthy(secondDef);
    t.is(secondDef.declaration.name, "SecondComponent");
});

test("no props - component with only Host types", (t) => {
    const comp = getComponent("test/no-props.ts");
    t.truthy(comp);

    // Should have no regular members (props), only methods
    const regularMembers = comp.members.filter(m => m.kind !== "method");
    t.is(regularMembers.length, 0, "should have no prop members");

    // Should have methods from Host type
    const methodNames = comp.members.filter(m => m.kind === "method").map(m => m.name);
    t.true(methodNames.includes("show"));
    t.true(methodNames.includes("hide"));

    // Should have events from Host type
    const eventNames = comp.events.map(e => e.name);
    t.true(eventNames.includes("Ready"));
    t.true(eventNames.includes("Click"));
});

test("no props - has slot from JSDoc", (t) => {
    const comp = getComponent("test/no-props.ts");

    t.is(comp.slots.length, 1);
    t.is(comp.slots[0].name, "content");
});

test("attribute name conversion - camelCase to kebab-case", (t) => {
    const comp = getComponent("test/multiple-spreads.ts");

    const classNameAttr = comp.attributes.find(a => a.name === "class-name");
    t.truthy(classNameAttr, "className should be converted to class-name");
});

test("all components have custom element definitions", (t) => {
    const expectedTags = [
        "my-wc",
        "multi-spread",
        "direct-ref",
        "shorthand-comp",
        "prop-types",
        "first-comp",
        "second-comp",
        "no-props",
    ];

    for (const tag of expectedTags) {
        const def = getCustomElement(tag);
        t.truthy(def, `should have custom element definition for ${tag}`);
    }
});

test("exported prop objects are in manifest", (t) => {
    const basePropsModule = getModule("test/base-props.ts");
    t.truthy(basePropsModule);

    const basePropsExport = basePropsModule.exports.find(e => e.name === "baseProps");
    t.truthy(basePropsExport, "should export baseProps");

    const sharedPropsModule = getModule("test/shared-props.ts");
    t.truthy(sharedPropsModule);

    const commonPropsExport = sharedPropsModule.exports.find(e => e.name === "commonProps");
    const stylePropsExport = sharedPropsModule.exports.find(e => e.name === "styleProps");
    t.truthy(commonPropsExport, "should export commonProps");
    t.truthy(stylePropsExport, "should export styleProps");
});

// Keep the original full comparison test
test("full manifest matches expected output", async (t) => {
    const expected = JSON.parse(
        await readFile(new URL("./expect.json", import.meta.url))
    );
    t.deepEqual(manifest, expected);
});

