import type * as rdfjs from "@rdfjs/types";
import { sha256 } from "js-sha256";
import { DataFactory as dataFactory } from "n3";
import * as purify from "purify-ts";
import * as rdfLiteral from "rdf-literal";
import * as rdfjsResource from "rdfjs-resource";
import { z as zod } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
export type EqualsResult = purify.Either<EqualsResult.Unequal, true>;

export namespace EqualsResult {
  export const Equal: EqualsResult = purify.Either.of<Unequal, true>(true);

  export function fromBooleanEqualsResult(
    left: any,
    right: any,
    equalsResult: boolean | EqualsResult,
  ): EqualsResult {
    if (typeof equalsResult !== "boolean") {
      return equalsResult;
    }

    if (equalsResult) {
      return Equal;
    }
    return purify.Left({
      left,
      right,
      type: "BooleanEquals",
    });
  }

  export type Unequal =
    | {
        readonly left: {
          readonly array: readonly any[];
          readonly element: any;
          readonly elementIndex: number;
        };
        readonly right: {
          readonly array: readonly any[];
          readonly unequals: readonly Unequal[];
        };
        readonly type: "ArrayElement";
      }
    | {
        readonly left: readonly any[];
        readonly right: readonly any[];
        readonly type: "ArrayLength";
      }
    | {
        readonly left: any;
        readonly right: any;
        readonly type: "BooleanEquals";
      }
    | {
        readonly left: any;
        readonly right: any;
        readonly type: "LeftError";
      }
    | {
        readonly right: any;
        readonly type: "LeftNull";
      }
    | {
        readonly left: bigint | boolean | number | string;
        readonly right: bigint | boolean | number | string;
        readonly type: "Primitive";
      }
    | {
        readonly left: object;
        readonly right: object;
        readonly propertyName: string;
        readonly propertyValuesUnequal: Unequal;
        readonly type: "Property";
      }
    | {
        readonly left: any;
        readonly right: any;
        readonly type: "RightError";
      }
    | {
        readonly left: any;
        readonly type: "RightNull";
      };
}
/**
 * Compare two values for strict equality (===), returning an EqualsResult rather than a boolean.
 */
export function strictEquals<T extends bigint | boolean | number | string>(
  left: T,
  right: T,
): EqualsResult {
  return EqualsResult.fromBooleanEqualsResult(left, right, left === right);
}
export function maybeEquals<T>(
  leftMaybe: purify.Maybe<T>,
  rightMaybe: purify.Maybe<T>,
  valueEquals: (left: T, right: T) => boolean | EqualsResult,
): EqualsResult {
  if (leftMaybe.isJust()) {
    if (rightMaybe.isJust()) {
      return EqualsResult.fromBooleanEqualsResult(
        leftMaybe,
        rightMaybe,
        valueEquals(leftMaybe.unsafeCoerce(), rightMaybe.unsafeCoerce()),
      );
    }
    return purify.Left({
      left: leftMaybe.unsafeCoerce(),
      type: "RightNull",
    });
  }

  if (rightMaybe.isJust()) {
    return purify.Left({
      right: rightMaybe.unsafeCoerce(),
      type: "LeftNull",
    });
  }

  return EqualsResult.Equal;
}
/**
 * Compare two objects with equals(other: T): boolean methods and return an EqualsResult.
 */
export function booleanEquals<T extends { equals: (other: T) => boolean }>(
  left: T,
  right: T,
): EqualsResult {
  return EqualsResult.fromBooleanEqualsResult(left, right, left.equals(right));
}
export function arrayEquals<T>(
  leftArray: readonly T[],
  rightArray: readonly T[],
  elementEquals: (left: T, right: T) => boolean | EqualsResult,
): EqualsResult {
  if (leftArray.length !== rightArray.length) {
    return purify.Left({
      left: leftArray,
      right: rightArray,
      type: "ArrayLength",
    });
  }

  for (
    let leftElementIndex = 0;
    leftElementIndex < leftArray.length;
    leftElementIndex++
  ) {
    const leftElement = leftArray[leftElementIndex];

    const rightUnequals: EqualsResult.Unequal[] = [];
    for (
      let rightElementIndex = 0;
      rightElementIndex < rightArray.length;
      rightElementIndex++
    ) {
      const rightElement = rightArray[rightElementIndex];

      const leftElementEqualsRightElement =
        EqualsResult.fromBooleanEqualsResult(
          leftElement,
          rightElement,
          elementEquals(leftElement, rightElement),
        );
      if (leftElementEqualsRightElement.isRight()) {
        break; // left element === right element, break out of the right iteration
      }
      rightUnequals.push(
        leftElementEqualsRightElement.extract() as EqualsResult.Unequal,
      );
    }

    if (rightUnequals.length === rightArray.length) {
      // All right elements were unequal to the left element
      return purify.Left({
        left: {
          array: leftArray,
          element: leftElement,
          elementIndex: leftElementIndex,
        },
        right: {
          array: rightArray,
          unequals: rightUnequals,
        },
        type: "ArrayElement",
      });
    }
    // Else there was a right element equal to the left element, continue to the next left element
  }

  return EqualsResult.Equal;
}
type UnwrapR<T> = T extends purify.Either<any, infer R> ? R : never;
/**
 * Compare two Dates and return an EqualsResult.
 */
export function dateEquals(left: Date, right: Date): EqualsResult {
  return EqualsResult.fromBooleanEqualsResult(
    left,
    right,
    left.getTime() === right.getTime(),
  );
}
export abstract class Thing {
  readonly description: purify.Maybe<string>;
  abstract readonly identifier: rdfjs.NamedNode;
  readonly identifiers: readonly string[];
  readonly name: purify.Maybe<string>;
  readonly sameAs: readonly rdfjs.NamedNode[];
  abstract readonly type:
    | "GenderType"
    | "ImageObject"
    | "Occupation"
    | "Organization"
    | "Person"
    | "QuantitiveValue"
    | "Role";
  readonly url: purify.Maybe<rdfjs.NamedNode>;

  constructor(parameters: {
    readonly description?: purify.Maybe<string> | string;
    readonly identifiers?: readonly string[];
    readonly name?: purify.Maybe<string> | string;
    readonly sameAs?: readonly rdfjs.NamedNode[];
    readonly url?: rdfjs.NamedNode | purify.Maybe<rdfjs.NamedNode> | string;
  }) {
    if (purify.Maybe.isMaybe(parameters.description)) {
      this.description = parameters.description;
    } else if (typeof parameters.description === "string") {
      this.description = purify.Maybe.of(parameters.description);
    } else if (typeof parameters.description === "undefined") {
      this.description = purify.Maybe.empty();
    } else {
      this.description = parameters.description as never;
    }

    if (typeof parameters.identifiers === "undefined") {
      this.identifiers = [];
    } else if (Array.isArray(parameters.identifiers)) {
      this.identifiers = parameters.identifiers;
    } else {
      this.identifiers = parameters.identifiers as never;
    }

    if (purify.Maybe.isMaybe(parameters.name)) {
      this.name = parameters.name;
    } else if (typeof parameters.name === "string") {
      this.name = purify.Maybe.of(parameters.name);
    } else if (typeof parameters.name === "undefined") {
      this.name = purify.Maybe.empty();
    } else {
      this.name = parameters.name as never;
    }

    if (typeof parameters.sameAs === "undefined") {
      this.sameAs = [];
    } else if (Array.isArray(parameters.sameAs)) {
      this.sameAs = parameters.sameAs;
    } else {
      this.sameAs = parameters.sameAs as never;
    }

    if (purify.Maybe.isMaybe(parameters.url)) {
      this.url = parameters.url;
    } else if (typeof parameters.url === "object") {
      this.url = purify.Maybe.of(parameters.url);
    } else if (typeof parameters.url === "string") {
      this.url = purify.Maybe.of(dataFactory.namedNode(parameters.url));
    } else if (typeof parameters.url === "undefined") {
      this.url = purify.Maybe.empty();
    } else {
      this.url = parameters.url as never;
    }
  }

  equals(other: Thing): EqualsResult {
    return ((left, right) => maybeEquals(left, right, strictEquals))(
      this.description,
      other.description,
    )
      .mapLeft((propertyValuesUnequal) => ({
        left: this,
        right: other,
        propertyName: "description",
        propertyValuesUnequal,
        type: "Property" as const,
      }))
      .chain(() =>
        booleanEquals(this.identifier, other.identifier).mapLeft(
          (propertyValuesUnequal) => ({
            left: this,
            right: other,
            propertyName: "identifier",
            propertyValuesUnequal,
            type: "Property" as const,
          }),
        ),
      )
      .chain(() =>
        ((left, right) => arrayEquals(left, right, strictEquals))(
          this.identifiers,
          other.identifiers,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "identifiers",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      )
      .chain(() =>
        ((left, right) => maybeEquals(left, right, strictEquals))(
          this.name,
          other.name,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "name",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      )
      .chain(() =>
        ((left, right) => arrayEquals(left, right, booleanEquals))(
          this.sameAs,
          other.sameAs,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "sameAs",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      )
      .chain(() =>
        strictEquals(this.type, other.type).mapLeft(
          (propertyValuesUnequal) => ({
            left: this,
            right: other,
            propertyName: "type",
            propertyValuesUnequal,
            type: "Property" as const,
          }),
        ),
      )
      .chain(() =>
        ((left, right) => maybeEquals(left, right, booleanEquals))(
          this.url,
          other.url,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "url",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      );
  }

  hash<
    HasherT extends {
      update: (message: string | number[] | ArrayBuffer | Uint8Array) => void;
    },
  >(_hasher: HasherT): HasherT {
    this.description.ifJust((_value0) => {
      _hasher.update(_value0);
    });
    for (const _item0 of this.identifiers) {
      _hasher.update(_item0);
    }

    this.name.ifJust((_value0) => {
      _hasher.update(_value0);
    });
    for (const _item0 of this.sameAs) {
      _hasher.update(_item0.termType);
      _hasher.update(_item0.value);
    }

    this.url.ifJust((_value0) => {
      _hasher.update(_value0.termType);
      _hasher.update(_value0.value);
    });
    return _hasher;
  }

  toJson(): {
    readonly description: string | undefined;
    readonly "@id": string;
    readonly identifiers: readonly string[];
    readonly name: string | undefined;
    readonly sameAs: readonly { readonly "@id": string }[];
    readonly type:
      | "GenderType"
      | "ImageObject"
      | "Occupation"
      | "Organization"
      | "Person"
      | "QuantitiveValue"
      | "Role";
    readonly url: { readonly "@id": string } | undefined;
  } {
    return JSON.parse(
      JSON.stringify({
        description: this.description.map((_item) => _item).extract(),
        "@id": this.identifier.value,
        identifiers: this.identifiers.map((_item) => _item),
        name: this.name.map((_item) => _item).extract(),
        sameAs: this.sameAs.map((_item) => ({ "@id": _item.value })),
        type: this.type,
        url: this.url.map((_item) => ({ "@id": _item.value })).extract(),
      } satisfies ReturnType<Thing["toJson"]>),
    );
  }

  toRdf({
    mutateGraph,
    resourceSet,
  }: {
    ignoreRdfType?: boolean;
    mutateGraph?: rdfjsResource.MutableResource.MutateGraph;
    resourceSet: rdfjsResource.MutableResourceSet;
  }): rdfjsResource.MutableResource<rdfjs.NamedNode> {
    const _resource = resourceSet.mutableNamedResource(this.identifier, {
      mutateGraph,
    });
    _resource.add(
      dataFactory.namedNode("http://schema.org/description"),
      this.description,
    );
    _resource.add(
      dataFactory.namedNode("http://schema.org/identifier"),
      this.identifiers.map((_item) => _item),
    );
    _resource.add(dataFactory.namedNode("http://schema.org/name"), this.name);
    _resource.add(
      dataFactory.namedNode("http://schema.org/sameAs"),
      this.sameAs.map((_item) => _item),
    );
    _resource.add(dataFactory.namedNode("http://schema.org/url"), this.url);
    return _resource;
  }

  toString(): string {
    return JSON.stringify(this.toJson());
  }
}

export namespace Thing {
  export function propertiesFromJson(
    _json: unknown,
  ): purify.Either<
    zod.ZodError,
    {
      description: purify.Maybe<string>;
      identifier: rdfjs.NamedNode;
      identifiers: readonly string[];
      name: purify.Maybe<string>;
      sameAs: readonly rdfjs.NamedNode[];
      url: purify.Maybe<rdfjs.NamedNode>;
    }
  > {
    const _jsonSafeParseResult = thingJsonZodSchema().safeParse(_json);
    if (!_jsonSafeParseResult.success) {
      return purify.Left(_jsonSafeParseResult.error);
    }

    const _jsonObject = _jsonSafeParseResult.data;
    const description = purify.Maybe.fromNullable(_jsonObject["description"]);
    const identifier = dataFactory.namedNode(_jsonObject["@id"]);
    const identifiers = _jsonObject["identifiers"];
    const name = purify.Maybe.fromNullable(_jsonObject["name"]);
    const sameAs = _jsonObject["sameAs"].map((_item) =>
      dataFactory.namedNode(_item["@id"]),
    );
    const url = purify.Maybe.fromNullable(_jsonObject["url"]).map((_item) =>
      dataFactory.namedNode(_item["@id"]),
    );
    return purify.Either.of({
      description,
      identifier,
      identifiers,
      name,
      sameAs,
      url,
    });
  }

  export function propertiesFromRdf({
    ignoreRdfType: _ignoreRdfType,
    languageIn: _languageIn,
    resource: _resource,
    // @ts-ignore
    ..._context
  }: {
    [_index: string]: any;
    ignoreRdfType?: boolean;
    languageIn?: readonly string[];
    resource: rdfjsResource.Resource<rdfjs.NamedNode>;
  }): purify.Either<
    rdfjsResource.Resource.ValueError,
    {
      description: purify.Maybe<string>;
      identifier: rdfjs.NamedNode;
      identifiers: readonly string[];
      name: purify.Maybe<string>;
      sameAs: readonly rdfjs.NamedNode[];
      url: purify.Maybe<rdfjs.NamedNode>;
    }
  > {
    const _descriptionEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      purify.Maybe<string>
    > = purify.Either.of(
      _resource
        .values(dataFactory.namedNode("http://schema.org/description"), {
          unique: true,
        })
        .head()
        .chain((_value) => _value.toString())
        .toMaybe(),
    );
    if (_descriptionEither.isLeft()) {
      return _descriptionEither;
    }

    const description = _descriptionEither.unsafeCoerce();
    const identifier = _resource.identifier;
    const _identifiersEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      readonly string[]
    > = purify.Either.of([
      ..._resource
        .values(dataFactory.namedNode("http://schema.org/identifier"), {
          unique: true,
        })
        .flatMap((_item) =>
          _item
            .toValues()
            .head()
            .chain((_value) => _value.toString())
            .toMaybe()
            .toList(),
        ),
    ]);
    if (_identifiersEither.isLeft()) {
      return _identifiersEither;
    }

    const identifiers = _identifiersEither.unsafeCoerce();
    const _nameEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      purify.Maybe<string>
    > = purify.Either.of(
      _resource
        .values(dataFactory.namedNode("http://schema.org/name"), {
          unique: true,
        })
        .head()
        .chain((_value) => _value.toString())
        .toMaybe(),
    );
    if (_nameEither.isLeft()) {
      return _nameEither;
    }

    const name = _nameEither.unsafeCoerce();
    const _sameAsEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      readonly rdfjs.NamedNode[]
    > = purify.Either.of([
      ..._resource
        .values(dataFactory.namedNode("http://schema.org/sameAs"), {
          unique: true,
        })
        .flatMap((_item) =>
          _item
            .toValues()
            .head()
            .chain((_value) => _value.toIri())
            .toMaybe()
            .toList(),
        ),
    ]);
    if (_sameAsEither.isLeft()) {
      return _sameAsEither;
    }

    const sameAs = _sameAsEither.unsafeCoerce();
    const _urlEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      purify.Maybe<rdfjs.NamedNode>
    > = purify.Either.of(
      _resource
        .values(dataFactory.namedNode("http://schema.org/url"), {
          unique: true,
        })
        .head()
        .chain((_value) => _value.toIri())
        .toMaybe(),
    );
    if (_urlEither.isLeft()) {
      return _urlEither;
    }

    const url = _urlEither.unsafeCoerce();
    return purify.Either.of({
      description,
      identifier,
      identifiers,
      name,
      sameAs,
      url,
    });
  }

  export function jsonSchema() {
    return zodToJsonSchema(thingJsonZodSchema());
  }

  export function thingJsonUiSchema(parameters?: { scopePrefix?: string }) {
    const scopePrefix = parameters?.scopePrefix ?? "#";
    return {
      elements: [
        { scope: `${scopePrefix}/properties/description`, type: "Control" },
        {
          label: "Identifier",
          scope: `${scopePrefix}/properties/@id`,
          type: "Control",
        },
        { scope: `${scopePrefix}/properties/identifiers`, type: "Control" },
        { scope: `${scopePrefix}/properties/name`, type: "Control" },
        { scope: `${scopePrefix}/properties/sameAs`, type: "Control" },
        {
          rule: {
            condition: {
              schema: { const: "Thing" },
              scope: `${scopePrefix}/properties/type`,
            },
            effect: "HIDE",
          },
          scope: `${scopePrefix}/properties/type`,
          type: "Control",
        },
        { scope: `${scopePrefix}/properties/url`, type: "Control" },
      ],
      label: "Thing",
      type: "Group",
    };
  }

  export function thingJsonZodSchema() {
    return zod.object({
      description: zod.string().optional(),
      "@id": zod.string().min(1),
      identifiers: zod.string().array(),
      name: zod.string().optional(),
      sameAs: zod.object({ "@id": zod.string().min(1) }).array(),
      type: zod.enum([
        "GenderType",
        "ImageObject",
        "Occupation",
        "Organization",
        "Person",
        "QuantitiveValue",
        "Role",
      ]),
      url: zod.object({ "@id": zod.string().min(1) }).optional(),
    });
  }
}
export abstract class Intangible extends Thing {
  abstract override readonly identifier: rdfjs.NamedNode;
  abstract override readonly type:
    | "GenderType"
    | "Occupation"
    | "QuantitiveValue"
    | "Role";

  // biome-ignore lint/complexity/noUselessConstructor: Always have a constructor
  constructor(parameters: ConstructorParameters<typeof Thing>[0]) {
    super(parameters);
  }

  override toRdf({
    mutateGraph,
    resourceSet,
  }: {
    ignoreRdfType?: boolean;
    mutateGraph?: rdfjsResource.MutableResource.MutateGraph;
    resourceSet: rdfjsResource.MutableResourceSet;
  }): rdfjsResource.MutableResource<rdfjs.NamedNode> {
    const _resource = super.toRdf({
      ignoreRdfType: true,
      mutateGraph,
      resourceSet,
    });
    return _resource;
  }

  override toString(): string {
    return JSON.stringify(this.toJson());
  }
}

export namespace Intangible {
  export function propertiesFromJson(
    _json: unknown,
  ): purify.Either<
    zod.ZodError,
    { identifier: rdfjs.NamedNode } & UnwrapR<
      ReturnType<typeof Thing.propertiesFromJson>
    >
  > {
    const _jsonSafeParseResult = intangibleJsonZodSchema().safeParse(_json);
    if (!_jsonSafeParseResult.success) {
      return purify.Left(_jsonSafeParseResult.error);
    }

    const _jsonObject = _jsonSafeParseResult.data;
    const _super0Either = Thing.propertiesFromJson(_jsonObject);
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    const identifier = dataFactory.namedNode(_jsonObject["@id"]);
    return purify.Either.of({ ..._super0, identifier });
  }

  export function propertiesFromRdf({
    ignoreRdfType: _ignoreRdfType,
    languageIn: _languageIn,
    resource: _resource,
    // @ts-ignore
    ..._context
  }: {
    [_index: string]: any;
    ignoreRdfType?: boolean;
    languageIn?: readonly string[];
    resource: rdfjsResource.Resource<rdfjs.NamedNode>;
  }): purify.Either<
    rdfjsResource.Resource.ValueError,
    { identifier: rdfjs.NamedNode } & UnwrapR<
      ReturnType<typeof Thing.propertiesFromRdf>
    >
  > {
    const _super0Either = Thing.propertiesFromRdf({
      ..._context,
      ignoreRdfType: true,
      languageIn: _languageIn,
      resource: _resource,
    });
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    const identifier = _resource.identifier;
    return purify.Either.of({ ..._super0, identifier });
  }

  export function jsonSchema() {
    return zodToJsonSchema(intangibleJsonZodSchema());
  }

  export function intangibleJsonUiSchema(parameters?: {
    scopePrefix?: string;
  }) {
    const scopePrefix = parameters?.scopePrefix ?? "#";
    return {
      elements: [Thing.thingJsonUiSchema({ scopePrefix })],
      label: "Intangible",
      type: "Group",
    };
  }

  export function intangibleJsonZodSchema() {
    return Thing.thingJsonZodSchema().merge(
      zod.object({
        "@id": zod.string().min(1),
        type: zod.enum(["GenderType", "Occupation", "QuantitiveValue", "Role"]),
      }),
    );
  }
}
export abstract class StructuredValue extends Intangible {
  abstract override readonly identifier: rdfjs.NamedNode;
  abstract override readonly type: "QuantitiveValue";

  // biome-ignore lint/complexity/noUselessConstructor: Always have a constructor
  constructor(parameters: ConstructorParameters<typeof Intangible>[0]) {
    super(parameters);
  }

  override toRdf({
    mutateGraph,
    resourceSet,
  }: {
    ignoreRdfType?: boolean;
    mutateGraph?: rdfjsResource.MutableResource.MutateGraph;
    resourceSet: rdfjsResource.MutableResourceSet;
  }): rdfjsResource.MutableResource<rdfjs.NamedNode> {
    const _resource = super.toRdf({
      ignoreRdfType: true,
      mutateGraph,
      resourceSet,
    });
    return _resource;
  }

  override toString(): string {
    return JSON.stringify(this.toJson());
  }
}

export namespace StructuredValue {
  export function propertiesFromJson(
    _json: unknown,
  ): purify.Either<
    zod.ZodError,
    { identifier: rdfjs.NamedNode } & UnwrapR<
      ReturnType<typeof Intangible.propertiesFromJson>
    >
  > {
    const _jsonSafeParseResult =
      structuredValueJsonZodSchema().safeParse(_json);
    if (!_jsonSafeParseResult.success) {
      return purify.Left(_jsonSafeParseResult.error);
    }

    const _jsonObject = _jsonSafeParseResult.data;
    const _super0Either = Intangible.propertiesFromJson(_jsonObject);
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    const identifier = dataFactory.namedNode(_jsonObject["@id"]);
    return purify.Either.of({ ..._super0, identifier });
  }

  export function propertiesFromRdf({
    ignoreRdfType: _ignoreRdfType,
    languageIn: _languageIn,
    resource: _resource,
    // @ts-ignore
    ..._context
  }: {
    [_index: string]: any;
    ignoreRdfType?: boolean;
    languageIn?: readonly string[];
    resource: rdfjsResource.Resource<rdfjs.NamedNode>;
  }): purify.Either<
    rdfjsResource.Resource.ValueError,
    { identifier: rdfjs.NamedNode } & UnwrapR<
      ReturnType<typeof Intangible.propertiesFromRdf>
    >
  > {
    const _super0Either = Intangible.propertiesFromRdf({
      ..._context,
      ignoreRdfType: true,
      languageIn: _languageIn,
      resource: _resource,
    });
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    const identifier = _resource.identifier;
    return purify.Either.of({ ..._super0, identifier });
  }

  export function jsonSchema() {
    return zodToJsonSchema(structuredValueJsonZodSchema());
  }

  export function structuredValueJsonUiSchema(parameters?: {
    scopePrefix?: string;
  }) {
    const scopePrefix = parameters?.scopePrefix ?? "#";
    return {
      elements: [Intangible.intangibleJsonUiSchema({ scopePrefix })],
      label: "StructuredValue",
      type: "Group",
    };
  }

  export function structuredValueJsonZodSchema() {
    return Intangible.intangibleJsonZodSchema().merge(
      zod.object({
        "@id": zod.string().min(1),
        type: zod.literal("QuantitiveValue"),
      }),
    );
  }
}
export class Role extends Intangible {
  readonly endDate: purify.Maybe<Date>;
  private _identifier: rdfjs.NamedNode | undefined;
  readonly roleName: purify.Maybe<rdfjs.NamedNode>;
  readonly startDate: purify.Maybe<Date>;
  override readonly type = "Role";

  constructor(
    parameters: {
      readonly endDate?: Date | purify.Maybe<Date>;
      readonly identifier?: rdfjs.NamedNode | string;
      readonly roleName?:
        | rdfjs.NamedNode
        | purify.Maybe<rdfjs.NamedNode>
        | string;
      readonly startDate?: Date | purify.Maybe<Date>;
    } & ConstructorParameters<typeof Intangible>[0],
  ) {
    super(parameters);
    if (purify.Maybe.isMaybe(parameters.endDate)) {
      this.endDate = parameters.endDate;
    } else if (
      typeof parameters.endDate === "object" &&
      parameters.endDate instanceof Date
    ) {
      this.endDate = purify.Maybe.of(parameters.endDate);
    } else if (typeof parameters.endDate === "undefined") {
      this.endDate = purify.Maybe.empty();
    } else {
      this.endDate = parameters.endDate as never;
    }

    if (typeof parameters.identifier === "object") {
      this._identifier = parameters.identifier;
    } else if (typeof parameters.identifier === "string") {
      this._identifier = dataFactory.namedNode(parameters.identifier);
    } else if (typeof parameters.identifier === "undefined") {
    } else {
      this._identifier = parameters.identifier as never;
    }

    if (purify.Maybe.isMaybe(parameters.roleName)) {
      this.roleName = parameters.roleName;
    } else if (typeof parameters.roleName === "object") {
      this.roleName = purify.Maybe.of(parameters.roleName);
    } else if (typeof parameters.roleName === "string") {
      this.roleName = purify.Maybe.of(
        dataFactory.namedNode(parameters.roleName),
      );
    } else if (typeof parameters.roleName === "undefined") {
      this.roleName = purify.Maybe.empty();
    } else {
      this.roleName = parameters.roleName as never;
    }

    if (purify.Maybe.isMaybe(parameters.startDate)) {
      this.startDate = parameters.startDate;
    } else if (
      typeof parameters.startDate === "object" &&
      parameters.startDate instanceof Date
    ) {
      this.startDate = purify.Maybe.of(parameters.startDate);
    } else if (typeof parameters.startDate === "undefined") {
      this.startDate = purify.Maybe.empty();
    } else {
      this.startDate = parameters.startDate as never;
    }
  }

  override get identifier(): rdfjs.NamedNode {
    return typeof this._identifier !== "undefined"
      ? this._identifier
      : dataFactory.namedNode(
          `urn:shaclmate:object:${this.type}:${this.hash(sha256.create())}`,
        );
  }

  override equals(other: Role): EqualsResult {
    return super
      .equals(other)
      .chain(() =>
        ((left, right) => maybeEquals(left, right, dateEquals))(
          this.endDate,
          other.endDate,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "endDate",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      )
      .chain(() =>
        ((left, right) => maybeEquals(left, right, booleanEquals))(
          this.roleName,
          other.roleName,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "roleName",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      )
      .chain(() =>
        ((left, right) => maybeEquals(left, right, dateEquals))(
          this.startDate,
          other.startDate,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "startDate",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      );
  }

  override hash<
    HasherT extends {
      update: (message: string | number[] | ArrayBuffer | Uint8Array) => void;
    },
  >(_hasher: HasherT): HasherT {
    super.hash(_hasher);
    this.endDate.ifJust((_value0) => {
      _hasher.update(_value0.toISOString());
    });
    this.roleName.ifJust((_value0) => {
      _hasher.update(_value0.termType);
      _hasher.update(_value0.value);
    });
    this.startDate.ifJust((_value0) => {
      _hasher.update(_value0.toISOString());
    });
    return _hasher;
  }

  override toJson(): {
    readonly endDate: string | undefined;
    readonly roleName: { readonly "@id": string } | undefined;
    readonly startDate: string | undefined;
  } & ReturnType<Intangible["toJson"]> {
    return JSON.parse(
      JSON.stringify({
        ...super.toJson(),
        endDate: this.endDate
          .map((_item) => _item.toISOString().replace(/T.*$/, ""))
          .extract(),
        roleName: this.roleName
          .map((_item) => ({ "@id": _item.value }))
          .extract(),
        startDate: this.startDate
          .map((_item) => _item.toISOString().replace(/T.*$/, ""))
          .extract(),
      } satisfies ReturnType<Role["toJson"]>),
    );
  }

  override toRdf({
    ignoreRdfType,
    mutateGraph,
    resourceSet,
  }: {
    ignoreRdfType?: boolean;
    mutateGraph?: rdfjsResource.MutableResource.MutateGraph;
    resourceSet: rdfjsResource.MutableResourceSet;
  }): rdfjsResource.MutableResource<rdfjs.NamedNode> {
    const _resource = super.toRdf({
      ignoreRdfType: true,
      mutateGraph,
      resourceSet,
    });
    if (!ignoreRdfType) {
      _resource.add(
        _resource.dataFactory.namedNode(
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        ),
        _resource.dataFactory.namedNode("http://schema.org/Role"),
      );
    }

    _resource.add(
      dataFactory.namedNode("http://schema.org/endDate"),
      this.endDate.map((_value) =>
        rdfLiteral.toRdf(_value, {
          dataFactory,
          datatype: dataFactory.namedNode(
            "http://www.w3.org/2001/XMLSchema#date",
          ),
        }),
      ),
    );
    _resource.add(
      dataFactory.namedNode("http://schema.org/roleName"),
      this.roleName,
    );
    _resource.add(
      dataFactory.namedNode("http://schema.org/startDate"),
      this.startDate.map((_value) =>
        rdfLiteral.toRdf(_value, {
          dataFactory,
          datatype: dataFactory.namedNode(
            "http://www.w3.org/2001/XMLSchema#date",
          ),
        }),
      ),
    );
    return _resource;
  }

  override toString(): string {
    return JSON.stringify(this.toJson());
  }
}

export namespace Role {
  export function propertiesFromJson(
    _json: unknown,
  ): purify.Either<
    zod.ZodError,
    {
      endDate: purify.Maybe<Date>;
      identifier: rdfjs.NamedNode;
      roleName: purify.Maybe<rdfjs.NamedNode>;
      startDate: purify.Maybe<Date>;
    } & UnwrapR<ReturnType<typeof Intangible.propertiesFromJson>>
  > {
    const _jsonSafeParseResult = roleJsonZodSchema().safeParse(_json);
    if (!_jsonSafeParseResult.success) {
      return purify.Left(_jsonSafeParseResult.error);
    }

    const _jsonObject = _jsonSafeParseResult.data;
    const _super0Either = Intangible.propertiesFromJson(_jsonObject);
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    const endDate = purify.Maybe.fromNullable(_jsonObject["endDate"]).map(
      (_item) => new Date(_item),
    );
    const identifier = dataFactory.namedNode(_jsonObject["@id"]);
    const roleName = purify.Maybe.fromNullable(_jsonObject["roleName"]).map(
      (_item) => dataFactory.namedNode(_item["@id"]),
    );
    const startDate = purify.Maybe.fromNullable(_jsonObject["startDate"]).map(
      (_item) => new Date(_item),
    );
    return purify.Either.of({
      ..._super0,
      endDate,
      identifier,
      roleName,
      startDate,
    });
  }

  export function fromJson(json: unknown): purify.Either<zod.ZodError, Role> {
    return Role.propertiesFromJson(json).map(
      (properties) => new Role(properties),
    );
  }

  export function propertiesFromRdf({
    ignoreRdfType: _ignoreRdfType,
    languageIn: _languageIn,
    resource: _resource,
    // @ts-ignore
    ..._context
  }: {
    [_index: string]: any;
    ignoreRdfType?: boolean;
    languageIn?: readonly string[];
    resource: rdfjsResource.Resource<rdfjs.NamedNode>;
  }): purify.Either<
    rdfjsResource.Resource.ValueError,
    {
      endDate: purify.Maybe<Date>;
      identifier: rdfjs.NamedNode;
      roleName: purify.Maybe<rdfjs.NamedNode>;
      startDate: purify.Maybe<Date>;
    } & UnwrapR<ReturnType<typeof Intangible.propertiesFromRdf>>
  > {
    const _super0Either = Intangible.propertiesFromRdf({
      ..._context,
      ignoreRdfType: true,
      languageIn: _languageIn,
      resource: _resource,
    });
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    if (
      !_ignoreRdfType &&
      !_resource.isInstanceOf(dataFactory.namedNode("http://schema.org/Role"))
    ) {
      return purify.Left(
        new rdfjsResource.Resource.ValueError({
          focusResource: _resource,
          message: `${rdfjsResource.Resource.Identifier.toString(_resource.identifier)} has unexpected RDF type`,
          predicate: dataFactory.namedNode("http://schema.org/Role"),
        }),
      );
    }

    const _endDateEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      purify.Maybe<Date>
    > = purify.Either.of(
      _resource
        .values(dataFactory.namedNode("http://schema.org/endDate"), {
          unique: true,
        })
        .head()
        .chain((_value) => _value.toDate())
        .toMaybe(),
    );
    if (_endDateEither.isLeft()) {
      return _endDateEither;
    }

    const endDate = _endDateEither.unsafeCoerce();
    const identifier = _resource.identifier;
    const _roleNameEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      purify.Maybe<rdfjs.NamedNode>
    > = purify.Either.of(
      _resource
        .values(dataFactory.namedNode("http://schema.org/roleName"), {
          unique: true,
        })
        .head()
        .chain((_value) => _value.toIri())
        .toMaybe(),
    );
    if (_roleNameEither.isLeft()) {
      return _roleNameEither;
    }

    const roleName = _roleNameEither.unsafeCoerce();
    const _startDateEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      purify.Maybe<Date>
    > = purify.Either.of(
      _resource
        .values(dataFactory.namedNode("http://schema.org/startDate"), {
          unique: true,
        })
        .head()
        .chain((_value) => _value.toDate())
        .toMaybe(),
    );
    if (_startDateEither.isLeft()) {
      return _startDateEither;
    }

    const startDate = _startDateEither.unsafeCoerce();
    return purify.Either.of({
      ..._super0,
      endDate,
      identifier,
      roleName,
      startDate,
    });
  }

  export function fromRdf(
    parameters: Parameters<typeof Role.propertiesFromRdf>[0],
  ): purify.Either<rdfjsResource.Resource.ValueError, Role> {
    return Role.propertiesFromRdf(parameters).map(
      (properties) => new Role(properties),
    );
  }

  export const fromRdfType: rdfjs.NamedNode<string> = dataFactory.namedNode(
    "http://schema.org/Role",
  );

  export function jsonSchema() {
    return zodToJsonSchema(roleJsonZodSchema());
  }

  export function roleJsonUiSchema(parameters?: { scopePrefix?: string }) {
    const scopePrefix = parameters?.scopePrefix ?? "#";
    return {
      elements: [
        Intangible.intangibleJsonUiSchema({ scopePrefix }),
        { scope: `${scopePrefix}/properties/endDate`, type: "Control" },
        { scope: `${scopePrefix}/properties/roleName`, type: "Control" },
        { scope: `${scopePrefix}/properties/startDate`, type: "Control" },
      ],
      label: "Role",
      type: "Group",
    };
  }

  export function roleJsonZodSchema() {
    return Intangible.intangibleJsonZodSchema().merge(
      zod.object({
        endDate: zod.string().date().optional(),
        "@id": zod.string().min(1),
        roleName: zod.object({ "@id": zod.string().min(1) }).optional(),
        startDate: zod.string().date().optional(),
        type: zod.literal("Role"),
      }),
    );
  }
}
export class Person extends Thing {
  readonly birthDate: purify.Maybe<Date>;
  readonly familyName: purify.Maybe<string>;
  readonly gender: purify.Maybe<
    rdfjs.BlankNode | rdfjs.NamedNode | rdfjs.Literal
  >;
  readonly givenName: purify.Maybe<string>;
  readonly hasOccupation: readonly (Occupation | Role)[];
  readonly identifier: rdfjs.NamedNode;
  readonly images: readonly ImageObject[];
  memberOf: rdfjs.NamedNode[];
  override readonly type = "Person";

  constructor(
    parameters: {
      readonly birthDate?: Date | purify.Maybe<Date>;
      readonly familyName?: purify.Maybe<string> | string;
      readonly gender?:
        | (rdfjs.BlankNode | rdfjs.NamedNode | rdfjs.Literal)
        | Date
        | boolean
        | number
        | purify.Maybe<rdfjs.BlankNode | rdfjs.NamedNode | rdfjs.Literal>
        | string;
      readonly givenName?: purify.Maybe<string> | string;
      readonly hasOccupation?: readonly (Occupation | Role)[];
      readonly identifier: rdfjs.NamedNode | string;
      readonly images?: readonly ImageObject[];
      readonly memberOf?: readonly rdfjs.NamedNode[];
    } & ConstructorParameters<typeof Thing>[0],
  ) {
    super(parameters);
    if (purify.Maybe.isMaybe(parameters.birthDate)) {
      this.birthDate = parameters.birthDate;
    } else if (
      typeof parameters.birthDate === "object" &&
      parameters.birthDate instanceof Date
    ) {
      this.birthDate = purify.Maybe.of(parameters.birthDate);
    } else if (typeof parameters.birthDate === "undefined") {
      this.birthDate = purify.Maybe.empty();
    } else {
      this.birthDate = parameters.birthDate as never;
    }

    if (purify.Maybe.isMaybe(parameters.familyName)) {
      this.familyName = parameters.familyName;
    } else if (typeof parameters.familyName === "string") {
      this.familyName = purify.Maybe.of(parameters.familyName);
    } else if (typeof parameters.familyName === "undefined") {
      this.familyName = purify.Maybe.empty();
    } else {
      this.familyName = parameters.familyName as never;
    }

    if (purify.Maybe.isMaybe(parameters.gender)) {
      this.gender = parameters.gender;
    } else if (typeof parameters.gender === "boolean") {
      this.gender = purify.Maybe.of(
        rdfLiteral.toRdf(parameters.gender, { dataFactory }),
      );
    } else if (
      typeof parameters.gender === "object" &&
      parameters.gender instanceof Date
    ) {
      this.gender = purify.Maybe.of(
        rdfLiteral.toRdf(parameters.gender, { dataFactory }),
      );
    } else if (typeof parameters.gender === "number") {
      this.gender = purify.Maybe.of(
        rdfLiteral.toRdf(parameters.gender, { dataFactory }),
      );
    } else if (typeof parameters.gender === "string") {
      this.gender = purify.Maybe.of(dataFactory.literal(parameters.gender));
    } else if (typeof parameters.gender === "object") {
      this.gender = purify.Maybe.of(parameters.gender);
    } else if (typeof parameters.gender === "undefined") {
      this.gender = purify.Maybe.empty();
    } else {
      this.gender = parameters.gender as never;
    }

    if (purify.Maybe.isMaybe(parameters.givenName)) {
      this.givenName = parameters.givenName;
    } else if (typeof parameters.givenName === "string") {
      this.givenName = purify.Maybe.of(parameters.givenName);
    } else if (typeof parameters.givenName === "undefined") {
      this.givenName = purify.Maybe.empty();
    } else {
      this.givenName = parameters.givenName as never;
    }

    if (typeof parameters.hasOccupation === "undefined") {
      this.hasOccupation = [];
    } else if (Array.isArray(parameters.hasOccupation)) {
      this.hasOccupation = parameters.hasOccupation;
    } else {
      this.hasOccupation = parameters.hasOccupation as never;
    }

    if (typeof parameters.identifier === "object") {
      this.identifier = parameters.identifier;
    } else if (typeof parameters.identifier === "string") {
      this.identifier = dataFactory.namedNode(parameters.identifier);
    } else {
      this.identifier = parameters.identifier as never;
    }

    if (typeof parameters.images === "undefined") {
      this.images = [];
    } else if (Array.isArray(parameters.images)) {
      this.images = parameters.images;
    } else {
      this.images = parameters.images as never;
    }

    if (typeof parameters.memberOf === "undefined") {
      this.memberOf = [];
    } else if (Array.isArray(parameters.memberOf)) {
      this.memberOf = parameters.memberOf;
    } else {
      this.memberOf = parameters.memberOf as never;
    }
  }

  override equals(other: Person): EqualsResult {
    return super
      .equals(other)
      .chain(() =>
        ((left, right) => maybeEquals(left, right, dateEquals))(
          this.birthDate,
          other.birthDate,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "birthDate",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      )
      .chain(() =>
        ((left, right) => maybeEquals(left, right, strictEquals))(
          this.familyName,
          other.familyName,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "familyName",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      )
      .chain(() =>
        ((left, right) => maybeEquals(left, right, booleanEquals))(
          this.gender,
          other.gender,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "gender",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      )
      .chain(() =>
        ((left, right) => maybeEquals(left, right, strictEquals))(
          this.givenName,
          other.givenName,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "givenName",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      )
      .chain(() =>
        ((left, right) =>
          arrayEquals(
            left,
            right,
            (left: Occupation | Role, right: Occupation | Role) => {
              if (left.type === "Occupation" && right.type === "Occupation") {
                return ((left, right) => left.equals(right))(left, right);
              }
              if (left.type === "Role" && right.type === "Role") {
                return ((left, right) => left.equals(right))(left, right);
              }

              return purify.Left({
                left,
                right,
                propertyName: "type",
                propertyValuesUnequal: {
                  left: typeof left,
                  right: typeof right,
                  type: "BooleanEquals" as const,
                },
                type: "Property" as const,
              });
            },
          ))(this.hasOccupation, other.hasOccupation).mapLeft(
          (propertyValuesUnequal) => ({
            left: this,
            right: other,
            propertyName: "hasOccupation",
            propertyValuesUnequal,
            type: "Property" as const,
          }),
        ),
      )
      .chain(() =>
        ((left, right) =>
          arrayEquals(left, right, (left, right) => left.equals(right)))(
          this.images,
          other.images,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "images",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      )
      .chain(() =>
        ((left, right) => arrayEquals(left, right, booleanEquals))(
          this.memberOf,
          other.memberOf,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "memberOf",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      );
  }

  override hash<
    HasherT extends {
      update: (message: string | number[] | ArrayBuffer | Uint8Array) => void;
    },
  >(_hasher: HasherT): HasherT {
    super.hash(_hasher);
    this.birthDate.ifJust((_value0) => {
      _hasher.update(_value0.toISOString());
    });
    this.familyName.ifJust((_value0) => {
      _hasher.update(_value0);
    });
    this.gender.ifJust((_value0) => {
      _hasher.update(_value0.termType);
      _hasher.update(_value0.value);
    });
    this.givenName.ifJust((_value0) => {
      _hasher.update(_value0);
    });
    for (const _item0 of this.hasOccupation) {
      switch (_item0.type) {
        case "Occupation": {
          _item0.hash(_hasher);
          break;
        }
        case "Role": {
          _item0.hash(_hasher);
          break;
        }
      }
    }

    _hasher.update(this.identifier.value);
    for (const _item0 of this.images) {
      _item0.hash(_hasher);
    }

    for (const _item0 of this.memberOf) {
      _hasher.update(_item0.termType);
      _hasher.update(_item0.value);
    }

    return _hasher;
  }

  override toJson(): {
    readonly birthDate: string | undefined;
    readonly familyName: string | undefined;
    readonly gender:
      | (
          | {
              readonly "@id": string;
              readonly termType: "BlankNode" | "NamedNode";
            }
          | {
              readonly "@language": string | undefined;
              readonly "@type": string | undefined;
              readonly "@value": string;
              readonly termType: "Literal";
            }
        )
      | undefined;
    readonly givenName: string | undefined;
    readonly hasOccupation: readonly (
      | ReturnType<Occupation["toJson"]>
      | ReturnType<Role["toJson"]>
    )[];
    readonly images: readonly ReturnType<ImageObject["toJson"]>[];
    readonly memberOf: readonly { readonly "@id": string }[];
  } & ReturnType<Thing["toJson"]> {
    return JSON.parse(
      JSON.stringify({
        ...super.toJson(),
        birthDate: this.birthDate
          .map((_item) => _item.toISOString().replace(/T.*$/, ""))
          .extract(),
        familyName: this.familyName.map((_item) => _item).extract(),
        gender: this.gender
          .map((_item) =>
            _item.termType === "Literal"
              ? {
                  "@language":
                    _item.language.length > 0 ? _item.language : undefined,
                  "@type":
                    _item.datatype.value !==
                    "http://www.w3.org/2001/XMLSchema#string"
                      ? _item.datatype.value
                      : undefined,
                  "@value": _item.value,
                  termType: "Literal" as const,
                }
              : _item.termType === "NamedNode"
                ? { "@id": _item.value, termType: "NamedNode" as const }
                : { "@id": `_:${_item.value}`, termType: "BlankNode" as const },
          )
          .extract(),
        givenName: this.givenName.map((_item) => _item).extract(),
        hasOccupation: this.hasOccupation.map((_item) =>
          _item.type === "Role" ? _item.toJson() : _item.toJson(),
        ),
        images: this.images.map((_item) => _item.toJson()),
        memberOf: this.memberOf.map((_item) => ({ "@id": _item.value })),
      } satisfies ReturnType<Person["toJson"]>),
    );
  }

  override toRdf({
    ignoreRdfType,
    mutateGraph,
    resourceSet,
  }: {
    ignoreRdfType?: boolean;
    mutateGraph?: rdfjsResource.MutableResource.MutateGraph;
    resourceSet: rdfjsResource.MutableResourceSet;
  }): rdfjsResource.MutableResource<rdfjs.NamedNode> {
    const _resource = super.toRdf({
      ignoreRdfType: true,
      mutateGraph,
      resourceSet,
    });
    if (!ignoreRdfType) {
      _resource.add(
        _resource.dataFactory.namedNode(
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        ),
        _resource.dataFactory.namedNode("http://schema.org/Person"),
      );
    }

    _resource.add(
      dataFactory.namedNode("http://schema.org/birthDate"),
      this.birthDate.map((_value) =>
        rdfLiteral.toRdf(_value, {
          dataFactory,
          datatype: dataFactory.namedNode(
            "http://www.w3.org/2001/XMLSchema#date",
          ),
        }),
      ),
    );
    _resource.add(
      dataFactory.namedNode("http://schema.org/familyName"),
      this.familyName,
    );
    _resource.add(
      dataFactory.namedNode("http://schema.org/gender"),
      this.gender,
    );
    _resource.add(
      dataFactory.namedNode("http://schema.org/givenName"),
      this.givenName,
    );
    _resource.add(
      dataFactory.namedNode("http://schema.org/hasOccupation"),
      this.hasOccupation.map((_item) =>
        _item.type === "Role"
          ? _item.toRdf({ mutateGraph: mutateGraph, resourceSet: resourceSet })
          : _item.toRdf({ mutateGraph: mutateGraph, resourceSet: resourceSet }),
      ),
    );
    _resource.add(
      dataFactory.namedNode("http://schema.org/image"),
      this.images.map((_item) =>
        _item.toRdf({ mutateGraph: mutateGraph, resourceSet: resourceSet }),
      ),
    );
    _resource.add(
      dataFactory.namedNode("http://schema.org/memberOf"),
      this.memberOf.map((_item) => _item),
    );
    return _resource;
  }

  override toString(): string {
    return JSON.stringify(this.toJson());
  }
}

export namespace Person {
  export function propertiesFromJson(
    _json: unknown,
  ): purify.Either<
    zod.ZodError,
    {
      birthDate: purify.Maybe<Date>;
      familyName: purify.Maybe<string>;
      gender: purify.Maybe<rdfjs.BlankNode | rdfjs.NamedNode | rdfjs.Literal>;
      givenName: purify.Maybe<string>;
      hasOccupation: readonly (Occupation | Role)[];
      identifier: rdfjs.NamedNode;
      images: readonly ImageObject[];
      memberOf: rdfjs.NamedNode[];
    } & UnwrapR<ReturnType<typeof Thing.propertiesFromJson>>
  > {
    const _jsonSafeParseResult = personJsonZodSchema().safeParse(_json);
    if (!_jsonSafeParseResult.success) {
      return purify.Left(_jsonSafeParseResult.error);
    }

    const _jsonObject = _jsonSafeParseResult.data;
    const _super0Either = Thing.propertiesFromJson(_jsonObject);
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    const birthDate = purify.Maybe.fromNullable(_jsonObject["birthDate"]).map(
      (_item) => new Date(_item),
    );
    const familyName = purify.Maybe.fromNullable(_jsonObject["familyName"]);
    const gender = purify.Maybe.fromNullable(_jsonObject["gender"]).map(
      (_item) =>
        _item.termType === "Literal"
          ? dataFactory.literal(
              _item["@value"],
              typeof _item["@language"] !== "undefined"
                ? _item["@language"]
                : typeof _item["@type"] !== "undefined"
                  ? dataFactory.namedNode(_item["@type"])
                  : undefined,
            )
          : _item.termType === "NamedNode"
            ? dataFactory.namedNode(_item["@id"])
            : dataFactory.blankNode(_item["@id"].substring(2)),
    );
    const givenName = purify.Maybe.fromNullable(_jsonObject["givenName"]);
    const hasOccupation = _jsonObject["hasOccupation"].map((_item) =>
      _item.type === "Role"
        ? Role.fromJson(_item).unsafeCoerce()
        : Occupation.fromJson(_item).unsafeCoerce(),
    );
    const identifier = dataFactory.namedNode(_jsonObject["@id"]);
    const images = _jsonObject["images"].map((_item) =>
      ImageObject.fromJson(_item).unsafeCoerce(),
    );
    const memberOf = _jsonObject["memberOf"].map((_item) =>
      dataFactory.namedNode(_item["@id"]),
    );
    return purify.Either.of({
      ..._super0,
      birthDate,
      familyName,
      gender,
      givenName,
      hasOccupation,
      identifier,
      images,
      memberOf,
    });
  }

  export function fromJson(json: unknown): purify.Either<zod.ZodError, Person> {
    return Person.propertiesFromJson(json).map(
      (properties) => new Person(properties),
    );
  }

  export function propertiesFromRdf({
    ignoreRdfType: _ignoreRdfType,
    languageIn: _languageIn,
    resource: _resource,
    // @ts-ignore
    ..._context
  }: {
    [_index: string]: any;
    ignoreRdfType?: boolean;
    languageIn?: readonly string[];
    resource: rdfjsResource.Resource<rdfjs.NamedNode>;
  }): purify.Either<
    rdfjsResource.Resource.ValueError,
    {
      birthDate: purify.Maybe<Date>;
      familyName: purify.Maybe<string>;
      gender: purify.Maybe<rdfjs.BlankNode | rdfjs.NamedNode | rdfjs.Literal>;
      givenName: purify.Maybe<string>;
      hasOccupation: readonly (Occupation | Role)[];
      identifier: rdfjs.NamedNode;
      images: readonly ImageObject[];
      memberOf: rdfjs.NamedNode[];
    } & UnwrapR<ReturnType<typeof Thing.propertiesFromRdf>>
  > {
    const _super0Either = Thing.propertiesFromRdf({
      ..._context,
      ignoreRdfType: true,
      languageIn: _languageIn,
      resource: _resource,
    });
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    if (
      !_ignoreRdfType &&
      !_resource.isInstanceOf(dataFactory.namedNode("http://schema.org/Person"))
    ) {
      return purify.Left(
        new rdfjsResource.Resource.ValueError({
          focusResource: _resource,
          message: `${rdfjsResource.Resource.Identifier.toString(_resource.identifier)} has unexpected RDF type`,
          predicate: dataFactory.namedNode("http://schema.org/Person"),
        }),
      );
    }

    const _birthDateEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      purify.Maybe<Date>
    > = purify.Either.of(
      _resource
        .values(dataFactory.namedNode("http://schema.org/birthDate"), {
          unique: true,
        })
        .head()
        .chain((_value) => _value.toDate())
        .toMaybe(),
    );
    if (_birthDateEither.isLeft()) {
      return _birthDateEither;
    }

    const birthDate = _birthDateEither.unsafeCoerce();
    const _familyNameEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      purify.Maybe<string>
    > = purify.Either.of(
      _resource
        .values(dataFactory.namedNode("http://schema.org/familyName"), {
          unique: true,
        })
        .head()
        .chain((_value) => _value.toString())
        .toMaybe(),
    );
    if (_familyNameEither.isLeft()) {
      return _familyNameEither;
    }

    const familyName = _familyNameEither.unsafeCoerce();
    const _genderEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      purify.Maybe<rdfjs.BlankNode | rdfjs.NamedNode | rdfjs.Literal>
    > = purify.Either.of(
      _resource
        .values(dataFactory.namedNode("http://schema.org/gender"), {
          unique: true,
        })
        .head()
        .chain((_value) => purify.Either.of(_value.toTerm()))
        .toMaybe(),
    );
    if (_genderEither.isLeft()) {
      return _genderEither;
    }

    const gender = _genderEither.unsafeCoerce();
    const _givenNameEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      purify.Maybe<string>
    > = purify.Either.of(
      _resource
        .values(dataFactory.namedNode("http://schema.org/givenName"), {
          unique: true,
        })
        .head()
        .chain((_value) => _value.toString())
        .toMaybe(),
    );
    if (_givenNameEither.isLeft()) {
      return _givenNameEither;
    }

    const givenName = _givenNameEither.unsafeCoerce();
    const _hasOccupationEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      readonly (Occupation | Role)[]
    > = purify.Either.of([
      ..._resource
        .values(dataFactory.namedNode("http://schema.org/hasOccupation"), {
          unique: true,
        })
        .flatMap((_item) =>
          (
            _item
              .toValues()
              .head()
              .chain((value) => value.toNamedResource())
              .chain((_resource) =>
                Occupation.fromRdf({
                  ..._context,
                  ignoreRdfType: true,
                  languageIn: _languageIn,
                  resource: _resource,
                }),
              ) as purify.Either<
              rdfjsResource.Resource.ValueError,
              Occupation | Role
            >
          )
            .altLazy(
              () =>
                _item
                  .toValues()
                  .head()
                  .chain((value) => value.toNamedResource())
                  .chain((_resource) =>
                    Role.fromRdf({
                      ..._context,
                      ignoreRdfType: true,
                      languageIn: _languageIn,
                      resource: _resource,
                    }),
                  ) as purify.Either<
                  rdfjsResource.Resource.ValueError,
                  Occupation | Role
                >,
            )
            .toMaybe()
            .toList(),
        ),
    ]);
    if (_hasOccupationEither.isLeft()) {
      return _hasOccupationEither;
    }

    const hasOccupation = _hasOccupationEither.unsafeCoerce();
    const identifier = _resource.identifier;
    const _imagesEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      readonly ImageObject[]
    > = purify.Either.of([
      ..._resource
        .values(dataFactory.namedNode("http://schema.org/image"), {
          unique: true,
        })
        .flatMap((_item) =>
          _item
            .toValues()
            .head()
            .chain((value) => value.toNamedResource())
            .chain((_resource) =>
              ImageObject.fromRdf({
                ..._context,
                ignoreRdfType: true,
                languageIn: _languageIn,
                resource: _resource,
              }),
            )
            .toMaybe()
            .toList(),
        ),
    ]);
    if (_imagesEither.isLeft()) {
      return _imagesEither;
    }

    const images = _imagesEither.unsafeCoerce();
    const _memberOfEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      rdfjs.NamedNode[]
    > = purify.Either.of([
      ..._resource
        .values(dataFactory.namedNode("http://schema.org/memberOf"), {
          unique: true,
        })
        .flatMap((_item) =>
          _item
            .toValues()
            .head()
            .chain((_value) => _value.toIri())
            .toMaybe()
            .toList(),
        ),
    ]);
    if (_memberOfEither.isLeft()) {
      return _memberOfEither;
    }

    const memberOf = _memberOfEither.unsafeCoerce();
    return purify.Either.of({
      ..._super0,
      birthDate,
      familyName,
      gender,
      givenName,
      hasOccupation,
      identifier,
      images,
      memberOf,
    });
  }

  export function fromRdf(
    parameters: Parameters<typeof Person.propertiesFromRdf>[0],
  ): purify.Either<rdfjsResource.Resource.ValueError, Person> {
    return Person.propertiesFromRdf(parameters).map(
      (properties) => new Person(properties),
    );
  }

  export const fromRdfType: rdfjs.NamedNode<string> = dataFactory.namedNode(
    "http://schema.org/Person",
  );

  export function jsonSchema() {
    return zodToJsonSchema(personJsonZodSchema());
  }

  export function personJsonUiSchema(parameters?: { scopePrefix?: string }) {
    const scopePrefix = parameters?.scopePrefix ?? "#";
    return {
      elements: [
        Thing.thingJsonUiSchema({ scopePrefix }),
        { scope: `${scopePrefix}/properties/birthDate`, type: "Control" },
        { scope: `${scopePrefix}/properties/familyName`, type: "Control" },
        { scope: `${scopePrefix}/properties/gender`, type: "Control" },
        { scope: `${scopePrefix}/properties/givenName`, type: "Control" },
        { scope: `${scopePrefix}/properties/hasOccupation`, type: "Control" },
        ImageObject.imageObjectJsonUiSchema({
          scopePrefix: `${scopePrefix}/properties/images`,
        }),
        { scope: `${scopePrefix}/properties/memberOf`, type: "Control" },
      ],
      label: "Person",
      type: "Group",
    };
  }

  export function personJsonZodSchema() {
    return Thing.thingJsonZodSchema().merge(
      zod.object({
        birthDate: zod.string().date().optional(),
        familyName: zod.string().optional(),
        gender: zod
          .discriminatedUnion("termType", [
            zod.object({
              "@id": zod.string().min(1),
              termType: zod.literal("BlankNode"),
            }),
            zod.object({
              "@id": zod.string().min(1),
              termType: zod.literal("NamedNode"),
            }),
            zod.object({
              "@language": zod.string().optional(),
              "@type": zod.string().optional(),
              "@value": zod.string(),
              termType: zod.literal("Literal"),
            }),
          ])
          .optional(),
        givenName: zod.string().optional(),
        hasOccupation: zod
          .discriminatedUnion("type", [
            Occupation.occupationJsonZodSchema(),
            Role.roleJsonZodSchema(),
          ])
          .array(),
        "@id": zod.string().min(1),
        images: ImageObject.imageObjectJsonZodSchema().array(),
        memberOf: zod.object({ "@id": zod.string().min(1) }).array(),
        type: zod.literal("Person"),
      }),
    );
  }
}
export class Organization extends Thing {
  readonly identifier: rdfjs.NamedNode;
  members: rdfjs.NamedNode[];
  parentOrganizations: rdfjs.NamedNode[];
  subOrganizations: rdfjs.NamedNode[];
  override readonly type = "Organization";

  constructor(
    parameters: {
      readonly identifier: rdfjs.NamedNode | string;
      readonly members?: readonly rdfjs.NamedNode[];
      readonly parentOrganizations?: readonly rdfjs.NamedNode[];
      readonly subOrganizations?: readonly rdfjs.NamedNode[];
    } & ConstructorParameters<typeof Thing>[0],
  ) {
    super(parameters);
    if (typeof parameters.identifier === "object") {
      this.identifier = parameters.identifier;
    } else if (typeof parameters.identifier === "string") {
      this.identifier = dataFactory.namedNode(parameters.identifier);
    } else {
      this.identifier = parameters.identifier as never;
    }

    if (typeof parameters.members === "undefined") {
      this.members = [];
    } else if (Array.isArray(parameters.members)) {
      this.members = parameters.members;
    } else {
      this.members = parameters.members as never;
    }

    if (typeof parameters.parentOrganizations === "undefined") {
      this.parentOrganizations = [];
    } else if (Array.isArray(parameters.parentOrganizations)) {
      this.parentOrganizations = parameters.parentOrganizations;
    } else {
      this.parentOrganizations = parameters.parentOrganizations as never;
    }

    if (typeof parameters.subOrganizations === "undefined") {
      this.subOrganizations = [];
    } else if (Array.isArray(parameters.subOrganizations)) {
      this.subOrganizations = parameters.subOrganizations;
    } else {
      this.subOrganizations = parameters.subOrganizations as never;
    }
  }

  override equals(other: Organization): EqualsResult {
    return super
      .equals(other)
      .chain(() =>
        ((left, right) => arrayEquals(left, right, booleanEquals))(
          this.members,
          other.members,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "members",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      )
      .chain(() =>
        ((left, right) => arrayEquals(left, right, booleanEquals))(
          this.parentOrganizations,
          other.parentOrganizations,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "parentOrganizations",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      )
      .chain(() =>
        ((left, right) => arrayEquals(left, right, booleanEquals))(
          this.subOrganizations,
          other.subOrganizations,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "subOrganizations",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      );
  }

  override hash<
    HasherT extends {
      update: (message: string | number[] | ArrayBuffer | Uint8Array) => void;
    },
  >(_hasher: HasherT): HasherT {
    super.hash(_hasher);
    _hasher.update(this.identifier.value);
    for (const _item0 of this.members) {
      _hasher.update(_item0.termType);
      _hasher.update(_item0.value);
    }

    for (const _item0 of this.parentOrganizations) {
      _hasher.update(_item0.termType);
      _hasher.update(_item0.value);
    }

    for (const _item0 of this.subOrganizations) {
      _hasher.update(_item0.termType);
      _hasher.update(_item0.value);
    }

    return _hasher;
  }

  override toJson(): {
    readonly members: readonly { readonly "@id": string }[];
    readonly parentOrganizations: readonly { readonly "@id": string }[];
    readonly subOrganizations: readonly { readonly "@id": string }[];
  } & ReturnType<Thing["toJson"]> {
    return JSON.parse(
      JSON.stringify({
        ...super.toJson(),
        members: this.members.map((_item) => ({ "@id": _item.value })),
        parentOrganizations: this.parentOrganizations.map((_item) => ({
          "@id": _item.value,
        })),
        subOrganizations: this.subOrganizations.map((_item) => ({
          "@id": _item.value,
        })),
      } satisfies ReturnType<Organization["toJson"]>),
    );
  }

  override toRdf({
    ignoreRdfType,
    mutateGraph,
    resourceSet,
  }: {
    ignoreRdfType?: boolean;
    mutateGraph?: rdfjsResource.MutableResource.MutateGraph;
    resourceSet: rdfjsResource.MutableResourceSet;
  }): rdfjsResource.MutableResource<rdfjs.NamedNode> {
    const _resource = super.toRdf({
      ignoreRdfType: true,
      mutateGraph,
      resourceSet,
    });
    if (!ignoreRdfType) {
      _resource.add(
        _resource.dataFactory.namedNode(
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        ),
        _resource.dataFactory.namedNode("http://schema.org/Organization"),
      );
    }

    _resource.add(
      dataFactory.namedNode("http://schema.org/member"),
      this.members.map((_item) => _item),
    );
    _resource.add(
      dataFactory.namedNode("http://schema.org/parentOrganization"),
      this.parentOrganizations.map((_item) => _item),
    );
    _resource.add(
      dataFactory.namedNode("http://schema.org/subOrganization"),
      this.subOrganizations.map((_item) => _item),
    );
    return _resource;
  }

  override toString(): string {
    return JSON.stringify(this.toJson());
  }
}

export namespace Organization {
  export function propertiesFromJson(
    _json: unknown,
  ): purify.Either<
    zod.ZodError,
    {
      identifier: rdfjs.NamedNode;
      members: rdfjs.NamedNode[];
      parentOrganizations: rdfjs.NamedNode[];
      subOrganizations: rdfjs.NamedNode[];
    } & UnwrapR<ReturnType<typeof Thing.propertiesFromJson>>
  > {
    const _jsonSafeParseResult = organizationJsonZodSchema().safeParse(_json);
    if (!_jsonSafeParseResult.success) {
      return purify.Left(_jsonSafeParseResult.error);
    }

    const _jsonObject = _jsonSafeParseResult.data;
    const _super0Either = Thing.propertiesFromJson(_jsonObject);
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    const identifier = dataFactory.namedNode(_jsonObject["@id"]);
    const members = _jsonObject["members"].map((_item) =>
      dataFactory.namedNode(_item["@id"]),
    );
    const parentOrganizations = _jsonObject["parentOrganizations"].map(
      (_item) => dataFactory.namedNode(_item["@id"]),
    );
    const subOrganizations = _jsonObject["subOrganizations"].map((_item) =>
      dataFactory.namedNode(_item["@id"]),
    );
    return purify.Either.of({
      ..._super0,
      identifier,
      members,
      parentOrganizations,
      subOrganizations,
    });
  }

  export function fromJson(
    json: unknown,
  ): purify.Either<zod.ZodError, Organization> {
    return Organization.propertiesFromJson(json).map(
      (properties) => new Organization(properties),
    );
  }

  export function propertiesFromRdf({
    ignoreRdfType: _ignoreRdfType,
    languageIn: _languageIn,
    resource: _resource,
    // @ts-ignore
    ..._context
  }: {
    [_index: string]: any;
    ignoreRdfType?: boolean;
    languageIn?: readonly string[];
    resource: rdfjsResource.Resource<rdfjs.NamedNode>;
  }): purify.Either<
    rdfjsResource.Resource.ValueError,
    {
      identifier: rdfjs.NamedNode;
      members: rdfjs.NamedNode[];
      parentOrganizations: rdfjs.NamedNode[];
      subOrganizations: rdfjs.NamedNode[];
    } & UnwrapR<ReturnType<typeof Thing.propertiesFromRdf>>
  > {
    const _super0Either = Thing.propertiesFromRdf({
      ..._context,
      ignoreRdfType: true,
      languageIn: _languageIn,
      resource: _resource,
    });
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    if (
      !_ignoreRdfType &&
      !_resource.isInstanceOf(
        dataFactory.namedNode("http://schema.org/Organization"),
      )
    ) {
      return purify.Left(
        new rdfjsResource.Resource.ValueError({
          focusResource: _resource,
          message: `${rdfjsResource.Resource.Identifier.toString(_resource.identifier)} has unexpected RDF type`,
          predicate: dataFactory.namedNode("http://schema.org/Organization"),
        }),
      );
    }

    const identifier = _resource.identifier;
    const _membersEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      rdfjs.NamedNode[]
    > = purify.Either.of([
      ..._resource
        .values(dataFactory.namedNode("http://schema.org/member"), {
          unique: true,
        })
        .flatMap((_item) =>
          _item
            .toValues()
            .head()
            .chain((_value) => _value.toIri())
            .toMaybe()
            .toList(),
        ),
    ]);
    if (_membersEither.isLeft()) {
      return _membersEither;
    }

    const members = _membersEither.unsafeCoerce();
    const _parentOrganizationsEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      rdfjs.NamedNode[]
    > = purify.Either.of([
      ..._resource
        .values(dataFactory.namedNode("http://schema.org/parentOrganization"), {
          unique: true,
        })
        .flatMap((_item) =>
          _item
            .toValues()
            .head()
            .chain((_value) => _value.toIri())
            .toMaybe()
            .toList(),
        ),
    ]);
    if (_parentOrganizationsEither.isLeft()) {
      return _parentOrganizationsEither;
    }

    const parentOrganizations = _parentOrganizationsEither.unsafeCoerce();
    const _subOrganizationsEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      rdfjs.NamedNode[]
    > = purify.Either.of([
      ..._resource
        .values(dataFactory.namedNode("http://schema.org/subOrganization"), {
          unique: true,
        })
        .flatMap((_item) =>
          _item
            .toValues()
            .head()
            .chain((_value) => _value.toIri())
            .toMaybe()
            .toList(),
        ),
    ]);
    if (_subOrganizationsEither.isLeft()) {
      return _subOrganizationsEither;
    }

    const subOrganizations = _subOrganizationsEither.unsafeCoerce();
    return purify.Either.of({
      ..._super0,
      identifier,
      members,
      parentOrganizations,
      subOrganizations,
    });
  }

  export function fromRdf(
    parameters: Parameters<typeof Organization.propertiesFromRdf>[0],
  ): purify.Either<rdfjsResource.Resource.ValueError, Organization> {
    return Organization.propertiesFromRdf(parameters).map(
      (properties) => new Organization(properties),
    );
  }

  export const fromRdfType: rdfjs.NamedNode<string> = dataFactory.namedNode(
    "http://schema.org/Organization",
  );

  export function jsonSchema() {
    return zodToJsonSchema(organizationJsonZodSchema());
  }

  export function organizationJsonUiSchema(parameters?: {
    scopePrefix?: string;
  }) {
    const scopePrefix = parameters?.scopePrefix ?? "#";
    return {
      elements: [
        Thing.thingJsonUiSchema({ scopePrefix }),
        { scope: `${scopePrefix}/properties/members`, type: "Control" },
        {
          scope: `${scopePrefix}/properties/parentOrganizations`,
          type: "Control",
        },
        {
          scope: `${scopePrefix}/properties/subOrganizations`,
          type: "Control",
        },
      ],
      label: "Organization",
      type: "Group",
    };
  }

  export function organizationJsonZodSchema() {
    return Thing.thingJsonZodSchema().merge(
      zod.object({
        "@id": zod.string().min(1),
        members: zod.object({ "@id": zod.string().min(1) }).array(),
        parentOrganizations: zod.object({ "@id": zod.string().min(1) }).array(),
        subOrganizations: zod.object({ "@id": zod.string().min(1) }).array(),
        type: zod.literal("Organization"),
      }),
    );
  }
}
export class Occupation extends Intangible {
  readonly identifier: rdfjs.NamedNode;
  override readonly type = "Occupation";

  constructor(
    parameters: {
      readonly identifier: rdfjs.NamedNode | string;
    } & ConstructorParameters<typeof Intangible>[0],
  ) {
    super(parameters);
    if (typeof parameters.identifier === "object") {
      this.identifier = parameters.identifier;
    } else if (typeof parameters.identifier === "string") {
      this.identifier = dataFactory.namedNode(parameters.identifier);
    } else {
      this.identifier = parameters.identifier as never;
    }
  }

  override hash<
    HasherT extends {
      update: (message: string | number[] | ArrayBuffer | Uint8Array) => void;
    },
  >(_hasher: HasherT): HasherT {
    super.hash(_hasher);
    _hasher.update(this.identifier.value);
    return _hasher;
  }

  override toRdf({
    ignoreRdfType,
    mutateGraph,
    resourceSet,
  }: {
    ignoreRdfType?: boolean;
    mutateGraph?: rdfjsResource.MutableResource.MutateGraph;
    resourceSet: rdfjsResource.MutableResourceSet;
  }): rdfjsResource.MutableResource<rdfjs.NamedNode> {
    const _resource = super.toRdf({
      ignoreRdfType: true,
      mutateGraph,
      resourceSet,
    });
    if (!ignoreRdfType) {
      _resource.add(
        _resource.dataFactory.namedNode(
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        ),
        _resource.dataFactory.namedNode("http://schema.org/Occupation"),
      );
    }

    return _resource;
  }

  override toString(): string {
    return JSON.stringify(this.toJson());
  }
}

export namespace Occupation {
  export function propertiesFromJson(
    _json: unknown,
  ): purify.Either<
    zod.ZodError,
    { identifier: rdfjs.NamedNode } & UnwrapR<
      ReturnType<typeof Intangible.propertiesFromJson>
    >
  > {
    const _jsonSafeParseResult = occupationJsonZodSchema().safeParse(_json);
    if (!_jsonSafeParseResult.success) {
      return purify.Left(_jsonSafeParseResult.error);
    }

    const _jsonObject = _jsonSafeParseResult.data;
    const _super0Either = Intangible.propertiesFromJson(_jsonObject);
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    const identifier = dataFactory.namedNode(_jsonObject["@id"]);
    return purify.Either.of({ ..._super0, identifier });
  }

  export function fromJson(
    json: unknown,
  ): purify.Either<zod.ZodError, Occupation> {
    return Occupation.propertiesFromJson(json).map(
      (properties) => new Occupation(properties),
    );
  }

  export function propertiesFromRdf({
    ignoreRdfType: _ignoreRdfType,
    languageIn: _languageIn,
    resource: _resource,
    // @ts-ignore
    ..._context
  }: {
    [_index: string]: any;
    ignoreRdfType?: boolean;
    languageIn?: readonly string[];
    resource: rdfjsResource.Resource<rdfjs.NamedNode>;
  }): purify.Either<
    rdfjsResource.Resource.ValueError,
    { identifier: rdfjs.NamedNode } & UnwrapR<
      ReturnType<typeof Intangible.propertiesFromRdf>
    >
  > {
    const _super0Either = Intangible.propertiesFromRdf({
      ..._context,
      ignoreRdfType: true,
      languageIn: _languageIn,
      resource: _resource,
    });
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    if (
      !_ignoreRdfType &&
      !_resource.isInstanceOf(
        dataFactory.namedNode("http://schema.org/Occupation"),
      )
    ) {
      return purify.Left(
        new rdfjsResource.Resource.ValueError({
          focusResource: _resource,
          message: `${rdfjsResource.Resource.Identifier.toString(_resource.identifier)} has unexpected RDF type`,
          predicate: dataFactory.namedNode("http://schema.org/Occupation"),
        }),
      );
    }

    const identifier = _resource.identifier;
    return purify.Either.of({ ..._super0, identifier });
  }

  export function fromRdf(
    parameters: Parameters<typeof Occupation.propertiesFromRdf>[0],
  ): purify.Either<rdfjsResource.Resource.ValueError, Occupation> {
    return Occupation.propertiesFromRdf(parameters).map(
      (properties) => new Occupation(properties),
    );
  }

  export const fromRdfType: rdfjs.NamedNode<string> = dataFactory.namedNode(
    "http://schema.org/Occupation",
  );

  export function jsonSchema() {
    return zodToJsonSchema(occupationJsonZodSchema());
  }

  export function occupationJsonUiSchema(parameters?: {
    scopePrefix?: string;
  }) {
    const scopePrefix = parameters?.scopePrefix ?? "#";
    return {
      elements: [Intangible.intangibleJsonUiSchema({ scopePrefix })],
      label: "Occupation",
      type: "Group",
    };
  }

  export function occupationJsonZodSchema() {
    return Intangible.intangibleJsonZodSchema().merge(
      zod.object({
        "@id": zod.string().min(1),
        type: zod.literal("Occupation"),
      }),
    );
  }
}
export class QuantitiveValue extends StructuredValue {
  readonly identifier: rdfjs.NamedNode;
  override readonly type = "QuantitiveValue";
  readonly value: purify.Maybe<number>;

  constructor(
    parameters: {
      readonly identifier: rdfjs.NamedNode | string;
      readonly value?: number | purify.Maybe<number>;
    } & ConstructorParameters<typeof StructuredValue>[0],
  ) {
    super(parameters);
    if (typeof parameters.identifier === "object") {
      this.identifier = parameters.identifier;
    } else if (typeof parameters.identifier === "string") {
      this.identifier = dataFactory.namedNode(parameters.identifier);
    } else {
      this.identifier = parameters.identifier as never;
    }

    if (purify.Maybe.isMaybe(parameters.value)) {
      this.value = parameters.value;
    } else if (typeof parameters.value === "number") {
      this.value = purify.Maybe.of(parameters.value);
    } else if (typeof parameters.value === "undefined") {
      this.value = purify.Maybe.empty();
    } else {
      this.value = parameters.value as never;
    }
  }

  override equals(other: QuantitiveValue): EqualsResult {
    return super
      .equals(other)
      .chain(() =>
        ((left, right) => maybeEquals(left, right, strictEquals))(
          this.value,
          other.value,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "value",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      );
  }

  override hash<
    HasherT extends {
      update: (message: string | number[] | ArrayBuffer | Uint8Array) => void;
    },
  >(_hasher: HasherT): HasherT {
    super.hash(_hasher);
    _hasher.update(this.identifier.value);
    this.value.ifJust((_value0) => {
      _hasher.update(_value0.toString());
    });
    return _hasher;
  }

  override toJson(): { readonly value: number | undefined } & ReturnType<
    StructuredValue["toJson"]
  > {
    return JSON.parse(
      JSON.stringify({
        ...super.toJson(),
        value: this.value.map((_item) => _item).extract(),
      } satisfies ReturnType<QuantitiveValue["toJson"]>),
    );
  }

  override toRdf({
    ignoreRdfType,
    mutateGraph,
    resourceSet,
  }: {
    ignoreRdfType?: boolean;
    mutateGraph?: rdfjsResource.MutableResource.MutateGraph;
    resourceSet: rdfjsResource.MutableResourceSet;
  }): rdfjsResource.MutableResource<rdfjs.NamedNode> {
    const _resource = super.toRdf({
      ignoreRdfType: true,
      mutateGraph,
      resourceSet,
    });
    if (!ignoreRdfType) {
      _resource.add(
        _resource.dataFactory.namedNode(
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        ),
        _resource.dataFactory.namedNode("http://schema.org/QuantitativeValue"),
      );
    }

    _resource.add(dataFactory.namedNode("http://schema.org/value"), this.value);
    return _resource;
  }

  override toString(): string {
    return JSON.stringify(this.toJson());
  }
}

export namespace QuantitiveValue {
  export function propertiesFromJson(
    _json: unknown,
  ): purify.Either<
    zod.ZodError,
    { identifier: rdfjs.NamedNode; value: purify.Maybe<number> } & UnwrapR<
      ReturnType<typeof StructuredValue.propertiesFromJson>
    >
  > {
    const _jsonSafeParseResult =
      quantitiveValueJsonZodSchema().safeParse(_json);
    if (!_jsonSafeParseResult.success) {
      return purify.Left(_jsonSafeParseResult.error);
    }

    const _jsonObject = _jsonSafeParseResult.data;
    const _super0Either = StructuredValue.propertiesFromJson(_jsonObject);
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    const identifier = dataFactory.namedNode(_jsonObject["@id"]);
    const value = purify.Maybe.fromNullable(_jsonObject["value"]);
    return purify.Either.of({ ..._super0, identifier, value });
  }

  export function fromJson(
    json: unknown,
  ): purify.Either<zod.ZodError, QuantitiveValue> {
    return QuantitiveValue.propertiesFromJson(json).map(
      (properties) => new QuantitiveValue(properties),
    );
  }

  export function propertiesFromRdf({
    ignoreRdfType: _ignoreRdfType,
    languageIn: _languageIn,
    resource: _resource,
    // @ts-ignore
    ..._context
  }: {
    [_index: string]: any;
    ignoreRdfType?: boolean;
    languageIn?: readonly string[];
    resource: rdfjsResource.Resource<rdfjs.NamedNode>;
  }): purify.Either<
    rdfjsResource.Resource.ValueError,
    { identifier: rdfjs.NamedNode; value: purify.Maybe<number> } & UnwrapR<
      ReturnType<typeof StructuredValue.propertiesFromRdf>
    >
  > {
    const _super0Either = StructuredValue.propertiesFromRdf({
      ..._context,
      ignoreRdfType: true,
      languageIn: _languageIn,
      resource: _resource,
    });
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    if (
      !_ignoreRdfType &&
      !_resource.isInstanceOf(
        dataFactory.namedNode("http://schema.org/QuantitativeValue"),
      )
    ) {
      return purify.Left(
        new rdfjsResource.Resource.ValueError({
          focusResource: _resource,
          message: `${rdfjsResource.Resource.Identifier.toString(_resource.identifier)} has unexpected RDF type`,
          predicate: dataFactory.namedNode(
            "http://schema.org/QuantitativeValue",
          ),
        }),
      );
    }

    const identifier = _resource.identifier;
    const _valueEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      purify.Maybe<number>
    > = purify.Either.of(
      _resource
        .values(dataFactory.namedNode("http://schema.org/value"), {
          unique: true,
        })
        .head()
        .chain((_value) => _value.toNumber())
        .toMaybe(),
    );
    if (_valueEither.isLeft()) {
      return _valueEither;
    }

    const value = _valueEither.unsafeCoerce();
    return purify.Either.of({ ..._super0, identifier, value });
  }

  export function fromRdf(
    parameters: Parameters<typeof QuantitiveValue.propertiesFromRdf>[0],
  ): purify.Either<rdfjsResource.Resource.ValueError, QuantitiveValue> {
    return QuantitiveValue.propertiesFromRdf(parameters).map(
      (properties) => new QuantitiveValue(properties),
    );
  }

  export const fromRdfType: rdfjs.NamedNode<string> = dataFactory.namedNode(
    "http://schema.org/QuantitativeValue",
  );

  export function jsonSchema() {
    return zodToJsonSchema(quantitiveValueJsonZodSchema());
  }

  export function quantitiveValueJsonUiSchema(parameters?: {
    scopePrefix?: string;
  }) {
    const scopePrefix = parameters?.scopePrefix ?? "#";
    return {
      elements: [
        StructuredValue.structuredValueJsonUiSchema({ scopePrefix }),
        { scope: `${scopePrefix}/properties/value`, type: "Control" },
      ],
      label: "QuantitiveValue",
      type: "Group",
    };
  }

  export function quantitiveValueJsonZodSchema() {
    return StructuredValue.structuredValueJsonZodSchema().merge(
      zod.object({
        "@id": zod.string().min(1),
        type: zod.literal("QuantitiveValue"),
        value: zod.number().optional(),
      }),
    );
  }
}
export abstract class CreativeWork extends Thing {
  abstract override readonly identifier: rdfjs.NamedNode;
  readonly isBasedOn: readonly rdfjs.NamedNode[];
  abstract override readonly type: "ImageObject";

  constructor(
    parameters: {
      readonly isBasedOn?: readonly rdfjs.NamedNode[];
    } & ConstructorParameters<typeof Thing>[0],
  ) {
    super(parameters);
    if (typeof parameters.isBasedOn === "undefined") {
      this.isBasedOn = [];
    } else if (Array.isArray(parameters.isBasedOn)) {
      this.isBasedOn = parameters.isBasedOn;
    } else {
      this.isBasedOn = parameters.isBasedOn as never;
    }
  }

  override equals(other: CreativeWork): EqualsResult {
    return super
      .equals(other)
      .chain(() =>
        ((left, right) => arrayEquals(left, right, booleanEquals))(
          this.isBasedOn,
          other.isBasedOn,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "isBasedOn",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      );
  }

  override hash<
    HasherT extends {
      update: (message: string | number[] | ArrayBuffer | Uint8Array) => void;
    },
  >(_hasher: HasherT): HasherT {
    super.hash(_hasher);
    for (const _item0 of this.isBasedOn) {
      _hasher.update(_item0.termType);
      _hasher.update(_item0.value);
    }

    return _hasher;
  }

  override toJson(): {
    readonly isBasedOn: readonly { readonly "@id": string }[];
  } & ReturnType<Thing["toJson"]> {
    return JSON.parse(
      JSON.stringify({
        ...super.toJson(),
        isBasedOn: this.isBasedOn.map((_item) => ({ "@id": _item.value })),
      } satisfies ReturnType<CreativeWork["toJson"]>),
    );
  }

  override toRdf({
    mutateGraph,
    resourceSet,
  }: {
    ignoreRdfType?: boolean;
    mutateGraph?: rdfjsResource.MutableResource.MutateGraph;
    resourceSet: rdfjsResource.MutableResourceSet;
  }): rdfjsResource.MutableResource<rdfjs.NamedNode> {
    const _resource = super.toRdf({
      ignoreRdfType: true,
      mutateGraph,
      resourceSet,
    });
    _resource.add(
      dataFactory.namedNode("http://schema.org/isBasedOn"),
      this.isBasedOn.map((_item) => _item),
    );
    return _resource;
  }

  override toString(): string {
    return JSON.stringify(this.toJson());
  }
}

export namespace CreativeWork {
  export function propertiesFromJson(
    _json: unknown,
  ): purify.Either<
    zod.ZodError,
    {
      identifier: rdfjs.NamedNode;
      isBasedOn: readonly rdfjs.NamedNode[];
    } & UnwrapR<ReturnType<typeof Thing.propertiesFromJson>>
  > {
    const _jsonSafeParseResult = creativeWorkJsonZodSchema().safeParse(_json);
    if (!_jsonSafeParseResult.success) {
      return purify.Left(_jsonSafeParseResult.error);
    }

    const _jsonObject = _jsonSafeParseResult.data;
    const _super0Either = Thing.propertiesFromJson(_jsonObject);
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    const identifier = dataFactory.namedNode(_jsonObject["@id"]);
    const isBasedOn = _jsonObject["isBasedOn"].map((_item) =>
      dataFactory.namedNode(_item["@id"]),
    );
    return purify.Either.of({ ..._super0, identifier, isBasedOn });
  }

  export function propertiesFromRdf({
    ignoreRdfType: _ignoreRdfType,
    languageIn: _languageIn,
    resource: _resource,
    // @ts-ignore
    ..._context
  }: {
    [_index: string]: any;
    ignoreRdfType?: boolean;
    languageIn?: readonly string[];
    resource: rdfjsResource.Resource<rdfjs.NamedNode>;
  }): purify.Either<
    rdfjsResource.Resource.ValueError,
    {
      identifier: rdfjs.NamedNode;
      isBasedOn: readonly rdfjs.NamedNode[];
    } & UnwrapR<ReturnType<typeof Thing.propertiesFromRdf>>
  > {
    const _super0Either = Thing.propertiesFromRdf({
      ..._context,
      ignoreRdfType: true,
      languageIn: _languageIn,
      resource: _resource,
    });
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    const identifier = _resource.identifier;
    const _isBasedOnEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      readonly rdfjs.NamedNode[]
    > = purify.Either.of([
      ..._resource
        .values(dataFactory.namedNode("http://schema.org/isBasedOn"), {
          unique: true,
        })
        .flatMap((_item) =>
          _item
            .toValues()
            .head()
            .chain((_value) => _value.toIri())
            .toMaybe()
            .toList(),
        ),
    ]);
    if (_isBasedOnEither.isLeft()) {
      return _isBasedOnEither;
    }

    const isBasedOn = _isBasedOnEither.unsafeCoerce();
    return purify.Either.of({ ..._super0, identifier, isBasedOn });
  }

  export function jsonSchema() {
    return zodToJsonSchema(creativeWorkJsonZodSchema());
  }

  export function creativeWorkJsonUiSchema(parameters?: {
    scopePrefix?: string;
  }) {
    const scopePrefix = parameters?.scopePrefix ?? "#";
    return {
      elements: [
        Thing.thingJsonUiSchema({ scopePrefix }),
        { scope: `${scopePrefix}/properties/isBasedOn`, type: "Control" },
      ],
      label: "CreativeWork",
      type: "Group",
    };
  }

  export function creativeWorkJsonZodSchema() {
    return Thing.thingJsonZodSchema().merge(
      zod.object({
        "@id": zod.string().min(1),
        isBasedOn: zod.object({ "@id": zod.string().min(1) }).array(),
        type: zod.literal("ImageObject"),
      }),
    );
  }
}
export abstract class MediaObject extends CreativeWork {
  readonly contentUrl: purify.Maybe<rdfjs.NamedNode>;
  readonly encodingFormat: purify.Maybe<string>;
  readonly height: purify.Maybe<QuantitiveValue>;
  abstract override readonly identifier: rdfjs.NamedNode;
  abstract override readonly type: "ImageObject";
  readonly width: purify.Maybe<QuantitiveValue>;

  constructor(
    parameters: {
      readonly contentUrl?:
        | rdfjs.NamedNode
        | purify.Maybe<rdfjs.NamedNode>
        | string;
      readonly encodingFormat?: purify.Maybe<string> | string;
      readonly height?: QuantitiveValue | purify.Maybe<QuantitiveValue>;
      readonly width?: QuantitiveValue | purify.Maybe<QuantitiveValue>;
    } & ConstructorParameters<typeof CreativeWork>[0],
  ) {
    super(parameters);
    if (purify.Maybe.isMaybe(parameters.contentUrl)) {
      this.contentUrl = parameters.contentUrl;
    } else if (typeof parameters.contentUrl === "object") {
      this.contentUrl = purify.Maybe.of(parameters.contentUrl);
    } else if (typeof parameters.contentUrl === "string") {
      this.contentUrl = purify.Maybe.of(
        dataFactory.namedNode(parameters.contentUrl),
      );
    } else if (typeof parameters.contentUrl === "undefined") {
      this.contentUrl = purify.Maybe.empty();
    } else {
      this.contentUrl = parameters.contentUrl as never;
    }

    if (purify.Maybe.isMaybe(parameters.encodingFormat)) {
      this.encodingFormat = parameters.encodingFormat;
    } else if (typeof parameters.encodingFormat === "string") {
      this.encodingFormat = purify.Maybe.of(parameters.encodingFormat);
    } else if (typeof parameters.encodingFormat === "undefined") {
      this.encodingFormat = purify.Maybe.empty();
    } else {
      this.encodingFormat = parameters.encodingFormat as never;
    }

    if (purify.Maybe.isMaybe(parameters.height)) {
      this.height = parameters.height;
    } else if (
      typeof parameters.height === "object" &&
      parameters.height instanceof QuantitiveValue
    ) {
      this.height = purify.Maybe.of(parameters.height);
    } else if (typeof parameters.height === "undefined") {
      this.height = purify.Maybe.empty();
    } else {
      this.height = parameters.height as never;
    }

    if (purify.Maybe.isMaybe(parameters.width)) {
      this.width = parameters.width;
    } else if (
      typeof parameters.width === "object" &&
      parameters.width instanceof QuantitiveValue
    ) {
      this.width = purify.Maybe.of(parameters.width);
    } else if (typeof parameters.width === "undefined") {
      this.width = purify.Maybe.empty();
    } else {
      this.width = parameters.width as never;
    }
  }

  override equals(other: MediaObject): EqualsResult {
    return super
      .equals(other)
      .chain(() =>
        ((left, right) => maybeEquals(left, right, booleanEquals))(
          this.contentUrl,
          other.contentUrl,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "contentUrl",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      )
      .chain(() =>
        ((left, right) => maybeEquals(left, right, strictEquals))(
          this.encodingFormat,
          other.encodingFormat,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "encodingFormat",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      )
      .chain(() =>
        ((left, right) =>
          maybeEquals(left, right, (left, right) => left.equals(right)))(
          this.height,
          other.height,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "height",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      )
      .chain(() =>
        ((left, right) =>
          maybeEquals(left, right, (left, right) => left.equals(right)))(
          this.width,
          other.width,
        ).mapLeft((propertyValuesUnequal) => ({
          left: this,
          right: other,
          propertyName: "width",
          propertyValuesUnequal,
          type: "Property" as const,
        })),
      );
  }

  override hash<
    HasherT extends {
      update: (message: string | number[] | ArrayBuffer | Uint8Array) => void;
    },
  >(_hasher: HasherT): HasherT {
    super.hash(_hasher);
    this.contentUrl.ifJust((_value0) => {
      _hasher.update(_value0.termType);
      _hasher.update(_value0.value);
    });
    this.encodingFormat.ifJust((_value0) => {
      _hasher.update(_value0);
    });
    this.height.ifJust((_value0) => {
      _value0.hash(_hasher);
    });
    this.width.ifJust((_value0) => {
      _value0.hash(_hasher);
    });
    return _hasher;
  }

  override toJson(): {
    readonly contentUrl: { readonly "@id": string } | undefined;
    readonly encodingFormat: string | undefined;
    readonly height: ReturnType<QuantitiveValue["toJson"]> | undefined;
    readonly width: ReturnType<QuantitiveValue["toJson"]> | undefined;
  } & ReturnType<CreativeWork["toJson"]> {
    return JSON.parse(
      JSON.stringify({
        ...super.toJson(),
        contentUrl: this.contentUrl
          .map((_item) => ({ "@id": _item.value }))
          .extract(),
        encodingFormat: this.encodingFormat.map((_item) => _item).extract(),
        height: this.height.map((_item) => _item.toJson()).extract(),
        width: this.width.map((_item) => _item.toJson()).extract(),
      } satisfies ReturnType<MediaObject["toJson"]>),
    );
  }

  override toRdf({
    mutateGraph,
    resourceSet,
  }: {
    ignoreRdfType?: boolean;
    mutateGraph?: rdfjsResource.MutableResource.MutateGraph;
    resourceSet: rdfjsResource.MutableResourceSet;
  }): rdfjsResource.MutableResource<rdfjs.NamedNode> {
    const _resource = super.toRdf({
      ignoreRdfType: true,
      mutateGraph,
      resourceSet,
    });
    _resource.add(
      dataFactory.namedNode("http://schema.org/contentUrl"),
      this.contentUrl,
    );
    _resource.add(
      dataFactory.namedNode("http://schema.org/encodingFormat"),
      this.encodingFormat,
    );
    _resource.add(
      dataFactory.namedNode("http://schema.org/height"),
      this.height.map((_value) =>
        _value.toRdf({ mutateGraph: mutateGraph, resourceSet: resourceSet }),
      ),
    );
    _resource.add(
      dataFactory.namedNode("http://schema.org/width"),
      this.width.map((_value) =>
        _value.toRdf({ mutateGraph: mutateGraph, resourceSet: resourceSet }),
      ),
    );
    return _resource;
  }

  override toString(): string {
    return JSON.stringify(this.toJson());
  }
}

export namespace MediaObject {
  export function propertiesFromJson(
    _json: unknown,
  ): purify.Either<
    zod.ZodError,
    {
      contentUrl: purify.Maybe<rdfjs.NamedNode>;
      encodingFormat: purify.Maybe<string>;
      height: purify.Maybe<QuantitiveValue>;
      identifier: rdfjs.NamedNode;
      width: purify.Maybe<QuantitiveValue>;
    } & UnwrapR<ReturnType<typeof CreativeWork.propertiesFromJson>>
  > {
    const _jsonSafeParseResult = mediaObjectJsonZodSchema().safeParse(_json);
    if (!_jsonSafeParseResult.success) {
      return purify.Left(_jsonSafeParseResult.error);
    }

    const _jsonObject = _jsonSafeParseResult.data;
    const _super0Either = CreativeWork.propertiesFromJson(_jsonObject);
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    const contentUrl = purify.Maybe.fromNullable(_jsonObject["contentUrl"]).map(
      (_item) => dataFactory.namedNode(_item["@id"]),
    );
    const encodingFormat = purify.Maybe.fromNullable(
      _jsonObject["encodingFormat"],
    );
    const height = purify.Maybe.fromNullable(_jsonObject["height"]).map(
      (_item) => QuantitiveValue.fromJson(_item).unsafeCoerce(),
    );
    const identifier = dataFactory.namedNode(_jsonObject["@id"]);
    const width = purify.Maybe.fromNullable(_jsonObject["width"]).map((_item) =>
      QuantitiveValue.fromJson(_item).unsafeCoerce(),
    );
    return purify.Either.of({
      ..._super0,
      contentUrl,
      encodingFormat,
      height,
      identifier,
      width,
    });
  }

  export function propertiesFromRdf({
    ignoreRdfType: _ignoreRdfType,
    languageIn: _languageIn,
    resource: _resource,
    // @ts-ignore
    ..._context
  }: {
    [_index: string]: any;
    ignoreRdfType?: boolean;
    languageIn?: readonly string[];
    resource: rdfjsResource.Resource<rdfjs.NamedNode>;
  }): purify.Either<
    rdfjsResource.Resource.ValueError,
    {
      contentUrl: purify.Maybe<rdfjs.NamedNode>;
      encodingFormat: purify.Maybe<string>;
      height: purify.Maybe<QuantitiveValue>;
      identifier: rdfjs.NamedNode;
      width: purify.Maybe<QuantitiveValue>;
    } & UnwrapR<ReturnType<typeof CreativeWork.propertiesFromRdf>>
  > {
    const _super0Either = CreativeWork.propertiesFromRdf({
      ..._context,
      ignoreRdfType: true,
      languageIn: _languageIn,
      resource: _resource,
    });
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    const _contentUrlEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      purify.Maybe<rdfjs.NamedNode>
    > = purify.Either.of(
      _resource
        .values(dataFactory.namedNode("http://schema.org/contentUrl"), {
          unique: true,
        })
        .head()
        .chain((_value) => _value.toIri())
        .toMaybe(),
    );
    if (_contentUrlEither.isLeft()) {
      return _contentUrlEither;
    }

    const contentUrl = _contentUrlEither.unsafeCoerce();
    const _encodingFormatEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      purify.Maybe<string>
    > = purify.Either.of(
      _resource
        .values(dataFactory.namedNode("http://schema.org/encodingFormat"), {
          unique: true,
        })
        .head()
        .chain((_value) => _value.toString())
        .toMaybe(),
    );
    if (_encodingFormatEither.isLeft()) {
      return _encodingFormatEither;
    }

    const encodingFormat = _encodingFormatEither.unsafeCoerce();
    const _heightEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      purify.Maybe<QuantitiveValue>
    > = purify.Either.of(
      _resource
        .values(dataFactory.namedNode("http://schema.org/height"), {
          unique: true,
        })
        .head()
        .chain((value) => value.toNamedResource())
        .chain((_resource) =>
          QuantitiveValue.fromRdf({
            ..._context,
            ignoreRdfType: true,
            languageIn: _languageIn,
            resource: _resource,
          }),
        )
        .toMaybe(),
    );
    if (_heightEither.isLeft()) {
      return _heightEither;
    }

    const height = _heightEither.unsafeCoerce();
    const identifier = _resource.identifier;
    const _widthEither: purify.Either<
      rdfjsResource.Resource.ValueError,
      purify.Maybe<QuantitiveValue>
    > = purify.Either.of(
      _resource
        .values(dataFactory.namedNode("http://schema.org/width"), {
          unique: true,
        })
        .head()
        .chain((value) => value.toNamedResource())
        .chain((_resource) =>
          QuantitiveValue.fromRdf({
            ..._context,
            ignoreRdfType: true,
            languageIn: _languageIn,
            resource: _resource,
          }),
        )
        .toMaybe(),
    );
    if (_widthEither.isLeft()) {
      return _widthEither;
    }

    const width = _widthEither.unsafeCoerce();
    return purify.Either.of({
      ..._super0,
      contentUrl,
      encodingFormat,
      height,
      identifier,
      width,
    });
  }

  export function jsonSchema() {
    return zodToJsonSchema(mediaObjectJsonZodSchema());
  }

  export function mediaObjectJsonUiSchema(parameters?: {
    scopePrefix?: string;
  }) {
    const scopePrefix = parameters?.scopePrefix ?? "#";
    return {
      elements: [
        CreativeWork.creativeWorkJsonUiSchema({ scopePrefix }),
        { scope: `${scopePrefix}/properties/contentUrl`, type: "Control" },
        { scope: `${scopePrefix}/properties/encodingFormat`, type: "Control" },
        QuantitiveValue.quantitiveValueJsonUiSchema({
          scopePrefix: `${scopePrefix}/properties/height`,
        }),
        QuantitiveValue.quantitiveValueJsonUiSchema({
          scopePrefix: `${scopePrefix}/properties/width`,
        }),
      ],
      label: "MediaObject",
      type: "Group",
    };
  }

  export function mediaObjectJsonZodSchema() {
    return CreativeWork.creativeWorkJsonZodSchema().merge(
      zod.object({
        contentUrl: zod.object({ "@id": zod.string().min(1) }).optional(),
        encodingFormat: zod.string().optional(),
        height: QuantitiveValue.quantitiveValueJsonZodSchema().optional(),
        "@id": zod.string().min(1),
        type: zod.literal("ImageObject"),
        width: QuantitiveValue.quantitiveValueJsonZodSchema().optional(),
      }),
    );
  }
}
export class ImageObject extends MediaObject {
  readonly identifier: rdfjs.NamedNode;
  override readonly type = "ImageObject";

  constructor(
    parameters: {
      readonly identifier: rdfjs.NamedNode | string;
    } & ConstructorParameters<typeof MediaObject>[0],
  ) {
    super(parameters);
    if (typeof parameters.identifier === "object") {
      this.identifier = parameters.identifier;
    } else if (typeof parameters.identifier === "string") {
      this.identifier = dataFactory.namedNode(parameters.identifier);
    } else {
      this.identifier = parameters.identifier as never;
    }
  }

  override hash<
    HasherT extends {
      update: (message: string | number[] | ArrayBuffer | Uint8Array) => void;
    },
  >(_hasher: HasherT): HasherT {
    super.hash(_hasher);
    _hasher.update(this.identifier.value);
    return _hasher;
  }

  override toRdf({
    ignoreRdfType,
    mutateGraph,
    resourceSet,
  }: {
    ignoreRdfType?: boolean;
    mutateGraph?: rdfjsResource.MutableResource.MutateGraph;
    resourceSet: rdfjsResource.MutableResourceSet;
  }): rdfjsResource.MutableResource<rdfjs.NamedNode> {
    const _resource = super.toRdf({
      ignoreRdfType: true,
      mutateGraph,
      resourceSet,
    });
    if (!ignoreRdfType) {
      _resource.add(
        _resource.dataFactory.namedNode(
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        ),
        _resource.dataFactory.namedNode("http://schema.org/ImageObject"),
      );
    }

    return _resource;
  }

  override toString(): string {
    return JSON.stringify(this.toJson());
  }
}

export namespace ImageObject {
  export function propertiesFromJson(
    _json: unknown,
  ): purify.Either<
    zod.ZodError,
    { identifier: rdfjs.NamedNode } & UnwrapR<
      ReturnType<typeof MediaObject.propertiesFromJson>
    >
  > {
    const _jsonSafeParseResult = imageObjectJsonZodSchema().safeParse(_json);
    if (!_jsonSafeParseResult.success) {
      return purify.Left(_jsonSafeParseResult.error);
    }

    const _jsonObject = _jsonSafeParseResult.data;
    const _super0Either = MediaObject.propertiesFromJson(_jsonObject);
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    const identifier = dataFactory.namedNode(_jsonObject["@id"]);
    return purify.Either.of({ ..._super0, identifier });
  }

  export function fromJson(
    json: unknown,
  ): purify.Either<zod.ZodError, ImageObject> {
    return ImageObject.propertiesFromJson(json).map(
      (properties) => new ImageObject(properties),
    );
  }

  export function propertiesFromRdf({
    ignoreRdfType: _ignoreRdfType,
    languageIn: _languageIn,
    resource: _resource,
    // @ts-ignore
    ..._context
  }: {
    [_index: string]: any;
    ignoreRdfType?: boolean;
    languageIn?: readonly string[];
    resource: rdfjsResource.Resource<rdfjs.NamedNode>;
  }): purify.Either<
    rdfjsResource.Resource.ValueError,
    { identifier: rdfjs.NamedNode } & UnwrapR<
      ReturnType<typeof MediaObject.propertiesFromRdf>
    >
  > {
    const _super0Either = MediaObject.propertiesFromRdf({
      ..._context,
      ignoreRdfType: true,
      languageIn: _languageIn,
      resource: _resource,
    });
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    if (
      !_ignoreRdfType &&
      !_resource.isInstanceOf(
        dataFactory.namedNode("http://schema.org/ImageObject"),
      )
    ) {
      return purify.Left(
        new rdfjsResource.Resource.ValueError({
          focusResource: _resource,
          message: `${rdfjsResource.Resource.Identifier.toString(_resource.identifier)} has unexpected RDF type`,
          predicate: dataFactory.namedNode("http://schema.org/ImageObject"),
        }),
      );
    }

    const identifier = _resource.identifier;
    return purify.Either.of({ ..._super0, identifier });
  }

  export function fromRdf(
    parameters: Parameters<typeof ImageObject.propertiesFromRdf>[0],
  ): purify.Either<rdfjsResource.Resource.ValueError, ImageObject> {
    return ImageObject.propertiesFromRdf(parameters).map(
      (properties) => new ImageObject(properties),
    );
  }

  export const fromRdfType: rdfjs.NamedNode<string> = dataFactory.namedNode(
    "http://schema.org/ImageObject",
  );

  export function jsonSchema() {
    return zodToJsonSchema(imageObjectJsonZodSchema());
  }

  export function imageObjectJsonUiSchema(parameters?: {
    scopePrefix?: string;
  }) {
    const scopePrefix = parameters?.scopePrefix ?? "#";
    return {
      elements: [MediaObject.mediaObjectJsonUiSchema({ scopePrefix })],
      label: "ImageObject",
      type: "Group",
    };
  }

  export function imageObjectJsonZodSchema() {
    return MediaObject.mediaObjectJsonZodSchema().merge(
      zod.object({
        "@id": zod.string().min(1),
        type: zod.literal("ImageObject"),
      }),
    );
  }
}
export abstract class Enumeration extends Intangible {
  abstract override readonly identifier: rdfjs.NamedNode;
  abstract override readonly type: "GenderType";

  // biome-ignore lint/complexity/noUselessConstructor: Always have a constructor
  constructor(parameters: ConstructorParameters<typeof Intangible>[0]) {
    super(parameters);
  }

  override toRdf({
    mutateGraph,
    resourceSet,
  }: {
    ignoreRdfType?: boolean;
    mutateGraph?: rdfjsResource.MutableResource.MutateGraph;
    resourceSet: rdfjsResource.MutableResourceSet;
  }): rdfjsResource.MutableResource<rdfjs.NamedNode> {
    const _resource = super.toRdf({
      ignoreRdfType: true,
      mutateGraph,
      resourceSet,
    });
    return _resource;
  }

  override toString(): string {
    return JSON.stringify(this.toJson());
  }
}

export namespace Enumeration {
  export function propertiesFromJson(
    _json: unknown,
  ): purify.Either<
    zod.ZodError,
    { identifier: rdfjs.NamedNode } & UnwrapR<
      ReturnType<typeof Intangible.propertiesFromJson>
    >
  > {
    const _jsonSafeParseResult = enumerationJsonZodSchema().safeParse(_json);
    if (!_jsonSafeParseResult.success) {
      return purify.Left(_jsonSafeParseResult.error);
    }

    const _jsonObject = _jsonSafeParseResult.data;
    const _super0Either = Intangible.propertiesFromJson(_jsonObject);
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    const identifier = dataFactory.namedNode(_jsonObject["@id"]);
    return purify.Either.of({ ..._super0, identifier });
  }

  export function propertiesFromRdf({
    ignoreRdfType: _ignoreRdfType,
    languageIn: _languageIn,
    resource: _resource,
    // @ts-ignore
    ..._context
  }: {
    [_index: string]: any;
    ignoreRdfType?: boolean;
    languageIn?: readonly string[];
    resource: rdfjsResource.Resource<rdfjs.NamedNode>;
  }): purify.Either<
    rdfjsResource.Resource.ValueError,
    { identifier: rdfjs.NamedNode } & UnwrapR<
      ReturnType<typeof Intangible.propertiesFromRdf>
    >
  > {
    const _super0Either = Intangible.propertiesFromRdf({
      ..._context,
      ignoreRdfType: true,
      languageIn: _languageIn,
      resource: _resource,
    });
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    const identifier = _resource.identifier;
    return purify.Either.of({ ..._super0, identifier });
  }

  export function jsonSchema() {
    return zodToJsonSchema(enumerationJsonZodSchema());
  }

  export function enumerationJsonUiSchema(parameters?: {
    scopePrefix?: string;
  }) {
    const scopePrefix = parameters?.scopePrefix ?? "#";
    return {
      elements: [Intangible.intangibleJsonUiSchema({ scopePrefix })],
      label: "Enumeration",
      type: "Group",
    };
  }

  export function enumerationJsonZodSchema() {
    return Intangible.intangibleJsonZodSchema().merge(
      zod.object({
        "@id": zod.string().min(1),
        type: zod.literal("GenderType"),
      }),
    );
  }
}
export class GenderType extends Enumeration {
  readonly identifier: rdfjs.NamedNode<
    "http://schema.org/Female" | "http://schema.org/Male"
  >;
  override readonly type = "GenderType";

  constructor(
    parameters: {
      readonly identifier:
        | "http://schema.org/Female"
        | "http://schema.org/Male"
        | rdfjs.NamedNode<
            "http://schema.org/Female" | "http://schema.org/Male"
          >;
    } & ConstructorParameters<typeof Enumeration>[0],
  ) {
    super(parameters);
    if (typeof parameters.identifier === "object") {
      this.identifier = parameters.identifier;
    } else if (typeof parameters.identifier === "string") {
      this.identifier = dataFactory.namedNode(parameters.identifier);
    } else {
      this.identifier = parameters.identifier as never;
    }
  }

  override hash<
    HasherT extends {
      update: (message: string | number[] | ArrayBuffer | Uint8Array) => void;
    },
  >(_hasher: HasherT): HasherT {
    super.hash(_hasher);
    _hasher.update(this.identifier.value);
    return _hasher;
  }

  override toRdf({
    ignoreRdfType,
    mutateGraph,
    resourceSet,
  }: {
    ignoreRdfType?: boolean;
    mutateGraph?: rdfjsResource.MutableResource.MutateGraph;
    resourceSet: rdfjsResource.MutableResourceSet;
  }): rdfjsResource.MutableResource<rdfjs.NamedNode> {
    const _resource = super.toRdf({
      ignoreRdfType: true,
      mutateGraph,
      resourceSet,
    });
    if (!ignoreRdfType) {
      _resource.add(
        _resource.dataFactory.namedNode(
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        ),
        _resource.dataFactory.namedNode("http://schema.org/GenderType"),
      );
    }

    return _resource;
  }

  override toString(): string {
    return JSON.stringify(this.toJson());
  }
}

export namespace GenderType {
  export function propertiesFromJson(
    _json: unknown,
  ): purify.Either<
    zod.ZodError,
    {
      identifier: rdfjs.NamedNode<
        "http://schema.org/Female" | "http://schema.org/Male"
      >;
    } & UnwrapR<ReturnType<typeof Enumeration.propertiesFromJson>>
  > {
    const _jsonSafeParseResult = genderTypeJsonZodSchema().safeParse(_json);
    if (!_jsonSafeParseResult.success) {
      return purify.Left(_jsonSafeParseResult.error);
    }

    const _jsonObject = _jsonSafeParseResult.data;
    const _super0Either = Enumeration.propertiesFromJson(_jsonObject);
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    const identifier = dataFactory.namedNode(_jsonObject["@id"]);
    return purify.Either.of({ ..._super0, identifier });
  }

  export function fromJson(
    json: unknown,
  ): purify.Either<zod.ZodError, GenderType> {
    return GenderType.propertiesFromJson(json).map(
      (properties) => new GenderType(properties),
    );
  }

  export function propertiesFromRdf({
    ignoreRdfType: _ignoreRdfType,
    languageIn: _languageIn,
    resource: _resource,
    // @ts-ignore
    ..._context
  }: {
    [_index: string]: any;
    ignoreRdfType?: boolean;
    languageIn?: readonly string[];
    resource: rdfjsResource.Resource<rdfjs.NamedNode>;
  }): purify.Either<
    rdfjsResource.Resource.ValueError,
    {
      identifier: rdfjs.NamedNode<
        "http://schema.org/Female" | "http://schema.org/Male"
      >;
    } & UnwrapR<ReturnType<typeof Enumeration.propertiesFromRdf>>
  > {
    const _super0Either = Enumeration.propertiesFromRdf({
      ..._context,
      ignoreRdfType: true,
      languageIn: _languageIn,
      resource: _resource,
    });
    if (_super0Either.isLeft()) {
      return _super0Either;
    }

    const _super0 = _super0Either.unsafeCoerce();
    if (
      !_ignoreRdfType &&
      !_resource.isInstanceOf(
        dataFactory.namedNode("http://schema.org/GenderType"),
      )
    ) {
      return purify.Left(
        new rdfjsResource.Resource.ValueError({
          focusResource: _resource,
          message: `${rdfjsResource.Resource.Identifier.toString(_resource.identifier)} has unexpected RDF type`,
          predicate: dataFactory.namedNode("http://schema.org/GenderType"),
        }),
      );
    }

    let identifier: rdfjs.NamedNode<
      "http://schema.org/Female" | "http://schema.org/Male"
    >;
    switch (_resource.identifier.value) {
      case "http://schema.org/Female":
        identifier = dataFactory.namedNode("http://schema.org/Female");
        break;
      case "http://schema.org/Male":
        identifier = dataFactory.namedNode("http://schema.org/Male");
        break;
      default:
        return purify.Left(
          new rdfjsResource.Resource.MistypedValueError({
            actualValue: _resource.identifier,
            expectedValueType:
              'rdfjs.NamedNode<"http://schema.org/Female" | "http://schema.org/Male">',
            focusResource: _resource,
            predicate: dataFactory.namedNode(
              "http://www.w3.org/1999/02/22-rdf-syntax-ns#subject",
            ),
          }),
        );
    }

    return purify.Either.of({ ..._super0, identifier });
  }

  export function fromRdf(
    parameters: Parameters<typeof GenderType.propertiesFromRdf>[0],
  ): purify.Either<rdfjsResource.Resource.ValueError, GenderType> {
    return GenderType.propertiesFromRdf(parameters).map(
      (properties) => new GenderType(properties),
    );
  }

  export const fromRdfType: rdfjs.NamedNode<string> = dataFactory.namedNode(
    "http://schema.org/GenderType",
  );

  export function jsonSchema() {
    return zodToJsonSchema(genderTypeJsonZodSchema());
  }

  export function genderTypeJsonUiSchema(parameters?: {
    scopePrefix?: string;
  }) {
    const scopePrefix = parameters?.scopePrefix ?? "#";
    return {
      elements: [Enumeration.enumerationJsonUiSchema({ scopePrefix })],
      label: "GenderType",
      type: "Group",
    };
  }

  export function genderTypeJsonZodSchema() {
    return Enumeration.enumerationJsonZodSchema().merge(
      zod.object({
        "@id": zod.enum(["http://schema.org/Female", "http://schema.org/Male"]),
        type: zod.literal("GenderType"),
      }),
    );
  }
}
