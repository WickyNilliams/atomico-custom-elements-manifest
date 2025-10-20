# Test Cases

This test suite covers a comprehensive range of Atomico component patterns and edge cases.

## Test Files

### `atomico.ts` - Main Component Test
Tests:
- Spread props (`...baseProps`)
- Direct inline props (`age`, `value`)
- Extended prop configuration with event
- Host generic type parameter with events and methods
- JSDoc tags (`@cssprop`)
- Custom event configuration

### `base-props.ts` - Shared Props Definition
Tests:
- Exported prop object for sharing
- JSDoc documentation on props

### `shared-props.ts` - Multiple Shared Props
Tests:
- Multiple exported prop objects from single module
- Reusable prop definitions

### `multiple-spreads.ts` - Multiple Spread Operators
Tests:
- Spreading multiple prop objects (`...commonProps`, `...styleProps`)
- Combining spreads with direct props
- JSDoc `@slot` tag
- Props with different types (String, Object, Boolean)

### `direct-reference.ts` - Direct Prop Object Reference
Tests:
- Using imported prop object directly (`props: commonProps`)
- JSDoc `@fires` tag for events
- JSDoc `@csspart` tag
- No inline props, only referenced props

### `shorthand-syntax.ts` - ES6 Shorthand Property
Tests:
- Shorthand syntax (`{ props }`)
- Import alias handling (`import { commonProps as props }`)

### `prop-types.ts` - Various Property Types
Tests:
- String, Number, Boolean, Array, Object types
- Custom attribute names (`attr: "data-custom"`)
- Host generic with events and methods
- Camel-case to kebab-case attribute conversion

### `multiple-components.ts` - Multiple Components per File
Tests:
- Two components in same file
- Separate customElements.define calls
- Independent JSDoc tags per component

### `no-props.ts` - Component Without Props
Tests:
- Component with empty config object
- Only Host generic type (no props)
- Events and methods without props
- JSDoc `@slot` tag

## Coverage

### Prop Definition Patterns
- ✅ Inline props: `{ props: { name: String } }`
- ✅ Spread props: `{ props: { ...baseProps } }`
- ✅ Multiple spreads: `{ props: { ...commonProps, ...styleProps } }`
- ✅ Direct reference: `{ props: baseProps }`
- ✅ Shorthand syntax: `{ props }` with import alias
- ✅ Extended prop config: `{ type: String, attr: "...", event: {...} }`

### Prop Types
- ✅ String
- ✅ Number
- ✅ Boolean
- ✅ Array
- ✅ Object

### Host Generic Type Parameter
- ✅ Events: `onMyEvent: Event`
- ✅ Custom events: `onDataChange: CustomEvent<T>`
- ✅ Methods: `myMethod: () => void`
- ✅ Component with only Host types (no props)

### JSDoc Support
- ✅ `@cssprop` / `@cssproperty` - CSS custom properties
- ✅ `@fires` / `@event` - Component events
- ✅ `@slot` - Slots
- ✅ `@csspart` - CSS shadow parts
- ✅ Prop descriptions
- ✅ Event descriptions

### Edge Cases
- ✅ Component without props
- ✅ Multiple components in one file
- ✅ Import aliases
- ✅ Custom attribute names
- ✅ Mixed prop sources (spread + inline + Host types)

### Attribute Name Conversion
- ✅ Camel case to kebab-case (`className` → `class-name`)
- ✅ Custom attribute override (`attr: "data-custom"`)

## Test Execution

All test cases are validated by comparing the generated `custom-elements.json` against the expected output in `test/expect.json`.

Run tests with:
```bash
npm test
```
