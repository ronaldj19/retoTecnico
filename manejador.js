'use strict';

const { DynamoDBClient, GetItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const axios = require('axios');

// Inicializar DynamoDB Client (AWS SDK v3)
const dynamoDb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

module.exports.crearElemento = async (evento) => {
  const datos = JSON.parse(evento.body);
  const id = datos.id;

  // Verificar si el elemento ya existe en la base de datos
  const parametrosBusqueda = {
    TableName: 'ElementosStarWars',
    Key: { id: { S: id } }, // AWS SDK v3 usa estructuras tipadas
  };

  try {
    const resultado = await dynamoDb.send(new GetItemCommand(parametrosBusqueda));
    if (resultado.Item) {
      return {
        statusCode: 400,
        body: JSON.stringify({ mensaje: 'El elemento ya existe en la base de datos' }),
      };
    }

    // Crear el elemento si no existe
    const datosTraducidos = traducirModelo(datos);

    const parametros = {
      TableName: 'ElementosStarWars',
      Item: {
        id: { S: datosTraducidos.id },
        nombre: { S: datosTraducidos.nombre },
        altura: { S: datosTraducidos.altura },
        peso: { S: datosTraducidos.peso },
      },
    };

    await dynamoDb.send(new PutItemCommand(parametros));
    return {
      statusCode: 200,
      body: JSON.stringify({ mensaje: 'Elemento creado exitosamente', elemento: datosTraducidos }),
    };
  } catch (error) {
    console.error('Error al crear elemento:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `No se pudo crear el elemento: ${error.message}` }),
    };
  }
};

module.exports.obtenerElemento = async (evento) => {
  const id = evento.pathParameters.id;

  // Buscar el elemento en la base de datos
  const parametros = {
    TableName: 'ElementosStarWars',
    Key: { id: { S: id } },
  };

  try {
    const resultado = await dynamoDb.send(new GetItemCommand(parametros));
    if (resultado.Item) {
      return {
        statusCode: 200,
        body: JSON.stringify({ elemento: mapearDesdeDynamoDB(resultado.Item) }),
      };
    }

    // Si el elemento no existe, obtener datos de SWAPI y guardar en la base de datos
    const datosSwapi = await obtenerDatosStarWars();
    if (datosSwapi) {
      const datosTraducidos = traducirModelo({ ...datosSwapi, id: id });
      const parametrosGuardar = {
        TableName: 'ElementosStarWars',
        Item: {
          id: { S: datosTraducidos.id },
          nombre: { S: datosTraducidos.nombre },
          altura: { S: datosTraducidos.altura },
          peso: { S: datosTraducidos.peso },
        },
      };

      await dynamoDb.send(new PutItemCommand(parametrosGuardar));
      return {
        statusCode: 200,
        body: JSON.stringify({ mensaje: 'Elemento obtenido y creado desde SWAPI', elemento: datosTraducidos }),
      };
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ mensaje: 'Elemento no encontrado y no se pudo obtener desde SWAPI' }),
    };
  } catch (error) {
    console.error('Error al obtener elemento:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `No se pudo obtener el elemento: ${error.message}` }),
    };
  }
};

const traducirModelo = (modelo) => {
  return {
    id: modelo.id || new Date().getTime().toString(),
    nombre: modelo.name,
    altura: modelo.height,
    peso: modelo.mass,
  };
};

const obtenerDatosStarWars = async () => {
  try {
    const respuesta = await axios.get('https://swapi.py4e.com/api/people/1/');
    return respuesta.data;
  } catch (error) {
    console.error('Error al obtener datos de SWAPI:', error);
    return null;
  }
};

// Función para mapear los datos desde DynamoDB a un formato más limpio
const mapearDesdeDynamoDB = (item) => {
  return {
    id: item.id.S,
    nombre: item.nombre.S,
    altura: item.altura.S,
    peso: item.peso.S,
  };
};
