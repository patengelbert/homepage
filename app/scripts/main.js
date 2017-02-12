
function printHello() { return 'Hello World!'; };

function insertText () {
    document.getElementById('heading').innerHTML = printHello();
}

exports:
    printHello
