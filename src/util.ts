import path from 'path';

export const resolvePath = (dir: string): string => {
  return path.resolve(__dirname, '..', dir);
};

const alphabet = '01234567890abcdefghijklmnopqrstuvwxyz';
export const generateId = (): string => {
  let output = '';

  while (output.length < 6) {
    const index = Math.floor(Math.random() * alphabet.length);
    output += alphabet[index];
  }

  return output;
};
