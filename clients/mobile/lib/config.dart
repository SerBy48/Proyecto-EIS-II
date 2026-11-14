/// Configuracion de la app movil.
///
/// La app habla UNICAMENTE con el API Gateway, igual que el cliente web. No
/// conoce los puertos ni la existencia de los ocho microservicios.
///
/// Direccion del gateway segun donde se ejecute:
///   Emulador Android   : http://10.0.2.2:8080
///   Simulador iOS      : http://localhost:8080
///   Dispositivo fisico : http://<IP-LOCAL-DE-TU-PC>:8080
///   Produccion         : https://api.tienda.co
///
/// Se puede sobreescribir sin tocar el codigo:
///   flutter run --dart-define=API_URL=http://192.168.1.5:8080
class Config {
  static const String gateway = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:8080',
  );

  static String get api => '$gateway/api';
}
