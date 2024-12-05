const { crearElemento, obtenerElemento } = require('../manejador');
const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');

// Configuración de entorno para AWS SDK
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'fake-access-key-id';
process.env.AWS_SECRET_ACCESS_KEY = 'fake-secret-access-key';

// Mock de DynamoDB usando jest
jest.mock('@aws-sdk/client-dynamodb', () => {
    const originalModule = jest.requireActual('@aws-sdk/client-dynamodb');
    return {
      ...originalModule,
      DynamoDBClient: jest.fn(() => ({
        send: jest.fn(async (command) => {
          const commandName = command.constructor.name;
  
          // Simular respuesta de GetItemCommand
          if (commandName === 'GetItemCommand') {
            if (command.input.Key.id.S === '1') {
              return {
                Item: {
                  id: { S: '1' },
                  nombre: { S: 'Luke Skywalker' },
                  altura: { S: '172' },
                  peso: { S: '77' },
                },
              };
            }
            return { Item: undefined }; // Elemento no encontrado
          }
  
          // Simular respuesta de PutItemCommand
          if (commandName === 'PutItemCommand') {
            return {}; // Simular éxito al insertar
          }
  
          throw new Error(`Comando no simulado: ${commandName}`);
        }),
      })),
      GetItemCommand: jest.fn(),
      PutItemCommand: jest.fn(),
    };
  });
  

// Mock de Axios para SWAPI
const mockAxios = new MockAdapter(axios);

describe('Pruebas para manejar elementos', () => {
  afterEach(() => {
    jest.clearAllMocks();
    mockAxios.reset();
  });

  test('Debe crear un elemento correctamente cuando no existe en DynamoDB', async () => {
    const evento = {
      body: JSON.stringify({
        id: '2',
        name: 'Leia Organa',
        height: '150',
        mass: '49',
      }),
    };

    const mockSend = jest.fn().mockImplementation(async (command) => {
      if (command.constructor.name === 'GetItemCommand') {
        return { Item: undefined }; // Simular que no existe el elemento
      }
      if (command.constructor.name === 'PutItemCommand') {
        return {}; // Simular éxito al insertar
      }
      throw new Error(`Comando no simulado: ${command.constructor.name}`);
    });
    require('@aws-sdk/client-dynamodb').DynamoDBClient.mockImplementation(() => ({ send: mockSend }));

    try {
      const resultado = await crearElemento(evento);
      expect(resultado.statusCode).toBe(200);
      expect(JSON.parse(resultado.body).mensaje).toBe('Elemento creado exitosamente');
    } catch (error) {
      console.error('Error al crear elemento:', error);
    }
  });

  test('Debe retornar error si el elemento ya existe en DynamoDB', async () => {
    const evento = {
      body: JSON.stringify({
        id: '1',
        name: 'Luke Skywalker',
        height: '172',
        mass: '77',
      }),
    };

    const mockSend = jest.fn().mockImplementation(async (command) => {
      if (command.constructor.name === 'GetItemCommand') {
        return {
          Item: {
            id: { S: '1' },
            nombre: { S: 'Luke Skywalker' },
            altura: { S: '172' },
            peso: { S: '77' },
          },
        }; // Simular que el elemento ya existe
      }
      throw new Error(`Comando no simulado: ${command.constructor.name}`);
    });
    require('@aws-sdk/client-dynamodb').DynamoDBClient.mockImplementation(() => ({ send: mockSend }));

    try {
      const resultado = await crearElemento(evento);
      expect(resultado.statusCode).toBe(400);
      expect(JSON.parse(resultado.body).mensaje).toBe('El elemento ya existe en la base de datos');
    } catch (error) {
      console.error('Error al crear elemento que ya existe:', error);
    }
  });

  test('Debe obtener un elemento existente desde DynamoDB', async () => {
    const evento = { pathParameters: { id: '1' } };

    const mockSend = jest.fn().mockImplementation(async (command) => {
      if (command.constructor.name === 'GetItemCommand') {
        return {
          Item: {
            id: { S: '1' },
            nombre: { S: 'Luke Skywalker' },
            altura: { S: '172' },
            peso: { S: '77' },
          },
        }; // Simular que el elemento existe
      }
      throw new Error(`Comando no simulado: ${command.constructor.name}`);
    });
    require('@aws-sdk/client-dynamodb').DynamoDBClient.mockImplementation(() => ({ send: mockSend }));

    try {
      const resultado = await obtenerElemento(evento);
      expect(resultado.statusCode).toBe(200);
      expect(JSON.parse(resultado.body).elemento.nombre).toBe('Luke Skywalker');
    } catch (error) {
      console.error('Error al obtener elemento:', error);
    }
  });

  test('Debe obtener y guardar un elemento desde la API de StarWars si no existe en DynamoDB', async () => {
    mockAxios.onGet('https://swapi.py4e.com/api/people/1/').reply(200, {
      name: 'Luke Skywalker',
      height: '172',
      mass: '77',
    });

    const evento = { pathParameters: { id: '2' } };

    const mockSend = jest.fn().mockImplementation(async (command) => {
      if (command.constructor.name === 'GetItemCommand') {
        return { Item: undefined }; // Simular que no existe el elemento
      }
      if (command.constructor.name === 'PutItemCommand') {
        return {}; // Simular éxito al insertar
      }
      throw new Error(`Comando no simulado: ${command.constructor.name}`);
    });
    require('@aws-sdk/client-dynamodb').DynamoDBClient.mockImplementation(() => ({ send: mockSend }));

    try {
      const resultado = await obtenerElemento(evento);
      expect(resultado.statusCode).toBe(200);
      const body = JSON.parse(resultado.body);
      expect(body.mensaje).toBe('Elemento obtenido y creado desde SWAPI');
      expect(body.elemento.nombre).toBe('Luke Skywalker');
    } catch (error) {
      console.error('Error al obtener y crear elemento desde SWAPI:', error);
    }
  });
});
