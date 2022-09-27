import Ajv from 'ajv';
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
    const ajvInstance = new Ajv({});
    const validator = ajvInstance.compile(schema);
    const isValid = validator(contents);
    if (!isValid) {
      throw new Error(
        'Document is not valid, because it does not fullfill the schema. ' +
        JSON5.stringify(validator.errors, null, 2)
      );
    }
  }

  return contents;
}
