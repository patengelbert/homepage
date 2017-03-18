// module "main.js"
/**
 *
 *
 * @export
 * @return {String} 'Hello World'
 */
export default function printHello() {
  return 'Hello World!';
};


window.onload = console.log(printHello());
