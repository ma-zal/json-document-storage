import Ajv, { ValidateFunction, ErrorObject } from 'ajv';
import * as JSON5 from 'json5';

/**
 * 
 * @param documentRaw Stringified JSON/JSON5 document
 * @param schema Optional schema (JSON)
 * @returns JSON of documentRaw
 */
export function parseDocument(documentRaw: string, schema: any|null): any {
  // Parse document into JSON
  let contents: any;
  try {
    contents = JSON5.parse(documentRaw);
  } catch (e: any) {
    e.message = `Document is not valid JSON/JSON5. ${e.message}`;
  }

  // Validate agains JSON schema
  if (schema) {
    let validator: ValidateFunction;
    try {
      const ajvInstance = new Ajv({});
      validator = ajvInstance.compile(schema);
    } catch (e: any) {
      e.message = `JSON schema has incorrect stucture. ${e.message}`;
      throw e;
    }
    const isValid = validator(contents);
    if (!isValid) {
      throw new Error(
        'Document is not valid, because it does not fullfill the schema. \n\n' +
        validator.errors?.map((validatorError: ErrorObject) => (
          'Invalid data in ' + validatorError.instancePath + ': ' + validatorError.message
        )).join('\n')
      );
    }
  }

  return contents;
}
