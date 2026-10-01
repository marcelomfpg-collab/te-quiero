import { describe, expect, it } from 'vitest';
import { makeCandidate } from '../test/factory';
import { fromBackup, toBackup } from './backup';
import { createLocalRepository } from './localRepository';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}

describe('createLocalRepository', () => {
  it('arranca vacío y conserva los datos entre aperturas del programa', async () => {
    const storage = memoryStorage();
    const repo = createLocalRepository(storage);
    expect(await repo.list()).toEqual([]);
    await repo.create(makeCandidate({ id: 'a' }));
    await repo.update('a', { stage: 'ENTREVISTA' });
    const reopened = createLocalRepository(storage);
    expect((await reopened.list())[0]).toMatchObject({ id: 'a', stage: 'ENTREVISTA' });
  });

  it('no permite dos postulantes con el mismo DNI', async () => {
    const repo = createLocalRepository(memoryStorage());
    await repo.create(makeCandidate({ id: 'a', dni: '12345678' }));
    await expect(repo.create(makeCandidate({ id: 'b', dni: '12345678' }))).rejects.toThrow(/12345678/);
  });

  it('elimina y reemplaza todo', async () => {
    const repo = createLocalRepository(memoryStorage());
    await repo.importMany([makeCandidate({ id: 'a', dni: '1' }), makeCandidate({ id: 'b', dni: '2' })]);
    await repo.remove('a');
    expect((await repo.list()).map((c) => c.id)).toEqual(['b']);
    await repo.replaceAll([]);
    expect(await repo.list()).toEqual([]);
  });
});

describe('copia de seguridad', () => {
  it('ida y vuelta sin pérdida', () => {
    const data = [makeCandidate({ id: 'x' })];
    expect(fromBackup(toBackup(data))).toEqual(data);
  });
  it('rechaza archivos que no son copias de este programa', () => {
    expect(() => fromBackup('hola')).toThrow(/válida/);
    expect(() => fromBackup('{"candidates":[]}')).toThrow(/este programa/);
  });
});
