/**
 * TypeORM shim to prevent from errors when sharing same models across backend and frontend.
 */

export function Column(typeOrOptions?: any, options?: any): PropertyDecorator {
  return function (object, propertyName) {};
}

export function CreateDateColumn(options?: any): PropertyDecorator {
  return function (object, propertyName) {};
}

export function ObjectIdColumn(columnOptions?: any): PropertyDecorator {
  return function (object, propertyName) {};
}

export function PrimaryColumn(typeOrOptions?: any, options?: any): PropertyDecorator {
  return function (object, propertyName) {};
}

export function PrimaryGeneratedColumn(options?: any): PropertyDecorator {
  return function (object, propertyName) {};
}

export function UpdateDateColumn(options?: any): PropertyDecorator {
  return function (object, propertyName) {};
}

export function Entity(name: any, options?: any): ClassDecorator {
  return function (object: any) {};
}

export function JoinColumn(options?: any): PropertyDecorator {
  return function (object, propertyName) {};
}

export function JoinTable(options?: any): PropertyDecorator {
  return function (object, propertyName) {};
}

export function ManyToMany(typeFunction: any, inverseSideOrOptions?: any, options?: any): PropertyDecorator {
  return function (object, propertyName) {};
}

export function ManyToOne(typeFunction: any, inverseSideOrOptions?: any, options?: any): PropertyDecorator {
  return function (object, propertyName) {};
}

export function OneToMany(typeFunction: any, inverseSideOrOptions?: any, options?: any): PropertyDecorator {
  return function (object, propertyName) {};
}

export function OneToOne(typeFunction: any, inverseSideOrOptions?: any, options?: any): PropertyDecorator {
  return function (object, propertyName) {};
}

export function RelationId(relation?: any): PropertyDecorator {
  return function (object, propertyName) {};
}

export function BeforeInsert(): PropertyDecorator {
  return function (object, propertyName) {};
}

export function BeforeUpdate(): PropertyDecorator {
  return function (object, propertyName) {};
}

export function AfterLoad(): PropertyDecorator {
  return function (object, propertyName) { };
}

export function AfterInsert(): PropertyDecorator {
  return function (object, propertyName) { };
}

export function AfterUpdate(): PropertyDecorator {
  return function (object, propertyName) { };
}

/**
 * Interface for objects that deal with (un)marshalling data.
 */
export interface ValueTransformer {
  /**
   * Used to marshal data when writing to the database.
   */
  to(value: any): any;
  /**
   * Used to unmarshal data when reading from the database.
   */
  from(value: any): any;
}

export type ColumnOptions = Record<string, any>;
export type RelationOptions = Record<string, any>;
