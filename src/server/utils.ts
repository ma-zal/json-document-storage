const uuidRegex = /^[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}$/;

export function validateUuid(param: string | string[]): string {
  if (typeof param !== 'string' || !uuidRegex.test(param)) {
    throw new Error('Param is not valid UUID.');
  }
  if (/[A-Z]/.test(param)) {
    throw new Error('Param is not valid UUID. Must be lowecase');
  }

  return param;
}
