console.log('app.js included');
// load /public/app/build/components.json
function OnReady(func) {
    var $this = this;
    this.then = function (onOk) {
        this.onOk = onOk;
    };
    this.catch = function (onError) {
        this.onError = onError;
    };
    func(function (data) {
        $this.onOk(data);
    }, function () {
        $this.onError();
    }
    );
}
var ajax = {
    get: function (url) {
        return new OnReady(function (onOk, onError) {
            var req = new XMLHttpRequest();
            req.onreadystatechange = function () {
                if (req.readyState === 4) {
                    var status = req.status;
                    if (status === 0 || (status >= 200 && status < 400)) {
                        var contentType = req.getResponseHeader("Content-Type");
                        if (contentType === 'application/json') {
                            onOk(JSON.parse(req.responseText));
                        } else {
                            onOk(req.responseText);
                        }
                    } else {
                        onError();
                    }
                }
            }
            req.open('GET', url, true);
            req.send();
        });
    }
};
Object.defineProperty(Array.prototype, 'first', {
    enumerable: false,
    value: function (x) {
        for (var k in this) {
            if (x(this[k])) {
                return this[k];
            }
        }
        return null;
    }
});
Object.defineProperty(Array.prototype, 'where', {
    enumerable: false,
    value: function (x) {
        var result = [];
        for (var k in this) {
            if (x(this[k])) {
                result.push(this[k]);
            }
        }
        return result;
    }
});
Object.defineProperty(Array.prototype, 'select', {
    enumerable: false,
    value: function (x) {
        var result = [];
        for (var k in this) {
            result.push(x(this[k]));
        }
        return result;
    }
});
Object.defineProperty(Array.prototype, 'each', {
    enumerable: false,
    value: function (x) {
        for (var k in this) {
            x(this[k]);
        }
        return this;
    }
});
//edgeon
//quicks
//
function Edgeon() {
    var $this = this;
    this.componentsUrl = '/public/build/components.json';
    this.components = {};
    this.start = function () {
        ajax.get(this.componentsUrl)
            .then(function (components) {
                $this.components = components;
                $this.render('HomePage');
            });
    };
    var nodes = [];
    var currentComponent = null;

    var getDataExpression = function (item) {
        if (item.expression) {
            var contentExpression = { call: true };
            if (item.raw) {
                contentExpression.func = new Function('_component', 'app', 'return ' + item.code + ';');
                return contentExpression;
            }
            contentExpression.func = new Function('_component', 'app', 'return app.htmlentities(' + item.code + ');');
            return contentExpression;
        }
        return { call: false, content: item.content };
    }

    var build = function (parent, instance) {
        var stack = arguments.length > 2 ? arguments[2] : false;
        var childs = parent.childs;
        var currentNodeList = [];
        var skip = false;
        var node = false;
        for (var i in childs) {
            var item = childs[i];
            if (item.type === 'text' && node && node.type === 'text') {
                node.contents[0].push(getDataExpression(item));
                if (item.subs) {
                    for (var s in item.subs) {
                        listenTo(node, item.subs[s]);
                    }
                }
                continue;
            }
            var component = false;
            var values = [getDataExpression(item)]; // text groups
            node = {
                type: item.type,
                childs: [], // TODO: process foreach
                contents: [values], // condition groups (if, else, elif)
                conditions: [true], // collection of expressions (if,else,elseif)
                parent: parent,
                count: 1, // 0 - hidden, 1 - show, > 1 - foreach
                take: 1, // 1 - default, > 1 - <template or <component, take next n items
                skip: false, // if was taken by previous then false
                data: false, // foreach target here
                domNodes: [], // DOM node if rendered
                instance: instance
            };
            var domNode = {
                ref: null, // final content
                active: true, // if,else,elseif
                key: false, // key of foreach iteration
                item: false, // value of foreach iteration
                parent: node
            };
            node.domNodes.push(domNode);
            if (item.type === 'component') {
                component = item.content;
            }
            if (item.subs) {
                for (var s in item.subs) {
                    listenTo(node, item.subs[s]);
                }
            }
            if (item.type === 'tag' && item.content === 'slot') {
                skip = true;
                var slotNameItem = item.attributes && item.attributes.first(function (x) { return x.content === 'name'; });
                var slotName = 0;
                var slotNameExpression = function (x) {
                    return !x.attributes;
                };
                if (slotNameItem) {
                    slotName = slotNameItem.childs[0].content;
                    slotNameExpression = function (x) {
                        return x.attributes
                            && x.attributes.first(function (y) {
                                return y.content === 'name'
                                    && y.childs[0].content === slotName;
                            });
                    }
                }
                // TODO: reassign parents
                if (stack) {
                    if (slotName === 0) {
                        var items = stack.where(function (x) {
                            return x.contents[0][0].content !== 'slotContent';
                        });
                        currentNodeList = currentNodeList.concat(items);
                    } else {
                        var slotContent = stack.first(function (x) {
                            return x.type === 'tag'
                                && x.contents[0][0].content === 'slotContent'
                                && slotNameExpression(x);
                        });
                        if (slotContent) {
                            currentNodeList = currentNodeList.concat(slotContent.childs);
                        }
                    }
                }
                continue;
            }
            // attributes

            // childs
            childNodes = false;
            if (item.childs) {
                childNodes = build(item, instance, stack);
            }
            if (item.attributes) {
                node.attributes = item.attributes.each(
                    function (a) {
                        a.contentExpression = getDataExpression(a);
                        a.childs.each(
                            function (v) {
                                v.contentExpression = getDataExpression(v);
                                if (v.subs) {
                                    for (var s in v.subs) {
                                        listenTo(a, v.subs[s]);
                                    }
                                }
                            }
                        );
                    }
                );
            }
            if (component) {
                var componenNodes = create(component, childNodes); // build(page.nodes, childNodes);
                currentNodeList = currentNodeList.concat(componenNodes);
            } else {
                if (childNodes) {
                    node.childs = childNodes;
                }
                currentNodeList.push(node);
            }
        }
        return currentNodeList;
    };

    var createDomNode = function (parent, node) {
        var texts = [];
        for (var i in node.contents[0]) {
            var contentExpression = node.contents[0][i];
            texts.push(contentExpression.call ? contentExpression.func(node.instance, $this) : contentExpression.content);
        }
        var val = texts.join(''); // TODO: process conditions (if,else,elif)
        var elm = false;
        switch (node.type) {
            case 'text': {
                if (parent === document) {
                    elm = document.childNodes[0]; // TODO: check for <!DOCTYPE html> node
                    break;
                }
                elm = document.createTextNode(val);
                parent.appendChild(elm);
                break;
            }
            case 'tag': {
                if (parent === document) {
                    elm = document.childNodes[1]; // TODO: check for html node
                    break;
                }
                if (val === 'script') {
                    return; // skip script for now, TODO: process scripts, styles
                }
                elm = document.createElement(val);
                parent.appendChild(elm);
                if (node.attributes) { // TODO: watch attribute variables
                    for (var a in node.attributes) {
                        var attr = node.attributes[a];
                        try {
                            if (attr.content[0] === '(') {
                                var eventName = attr.content.substring(1, attr.content.length - 1);
                                var actionContent = attr.childs[0].contentExpression.func;
                                console.log(elm, eventName, actionContent); // TODO: attach event data $event
                                elm.addEventListener(eventName, function () {
                                    actionContent(node.instance, $this);
                                });
                            } else {
                                elm.setAttribute(attr.content, attr.childs.select(
                                    function (x) {
                                        return x.contentExpression.call
                                            ? x.contentExpression.func(node.instance, $this)
                                            : x.contentExpression.content;
                                    }
                                ).join(''));
                            }
                        } catch (ex) {
                            console.error(ex);
                        }
                    }
                }
                break;
            }
            default:
                throw new Error('Node type \'' + item.type + '\' is not implemented.');
        }
        if (elm) {
            // clear up
            if (node.domNodes[0].ref !== null) {
                //replace node
                node.domNodes[0].ref.parentNode.replaceChild(elm, node.domNodes[0].ref);
            }
            node.domNodes[0].ref = elm;
        }
        elm && createDOM(elm, node.childs);
    }

    var createDOM = function (parent, nodes) {
        for (var i in nodes) {
            createDomNode(parent, nodes[i]);
        }
    }

    var nextInstanceId = 0;

    var getInstanceId = function (instance) {
        if (!('__id' in instance)) {
            instance.__id = ++nextInstanceId;
        }
        return instance.__id;
    }

    var renderQueue = {};
    var subscribers = {};


    var listenTo = function (node, path) {
        var iid = getInstanceId(node.instance);
        if (!(iid in subscribers)) {
            subscribers[iid] = {};
        }
        if (!(path in subscribers[iid])) {
            subscribers[iid][path] = [];
        }
        subscribers[iid][path].push(node);
    }

    var reRender = function () {
        for (var path in renderQueue) {
            for (var i in renderQueue[path]) {
                var node = renderQueue[path][i];
                createDomNode(node.domNodes[0].ref.parentNode, node);
            }
        }
        renderQueue = {};
    }

    var onChange = function (instance, path) {
        console.log('changed: ', instance, path);
        var iid = getInstanceId(instance);
        if (iid in subscribers
            && path in subscribers[iid]) {
            renderQueue[iid + '_' + path] = subscribers[iid][path];
            setTimeout(function () {
                reRender();
            }, 0);
        }
    };

    var makeReactive = function (obj) {
        var instance = arguments.length > 1 ? arguments[1] : obj;
        var path = arguments.length > 2 ? arguments[2] : 'this';
        if ('__reactive' in obj) {
            return obj;
        }
        obj['__reactive'] = true;
        var keys = Object.keys(obj);
        for (var i = 0; i < keys.length; i++) {
            defineReactive(instance, path + '.' + keys[i], obj, keys[i], obj[keys[i]]);
        }
        return obj;
    };

    var defineReactive = function (instance, path, obj, key, val) {
        if (val !== null && typeof val === 'object') {
            makeReactive(val, instance, path);
        }
        if (typeof val === 'function') { // reactive methods ???
            return;
        }
        Object.defineProperty(obj, key, {
            enumerable: true,
            configurable: true,
            get: function () {
                return val;
            },
            set: function (newVal) {
                onChange(instance, path);
                val = newVal;
            }
        });
    };

    var resolve = function (name) {
        // TODO: check scope and/or cache
        var dependencies = $this.components[name].dependencies;
        if (!dependencies) {
            return makeReactive(new window[name]());
        }
        var arguments = [];
        for (var i in dependencies) {
            var d = dependencies[i];
            var a = null; // d.null
            if (d.default) {
                a = d.default; // TODO: copy object or array
            } else if (d.builtIn) {
                a = d.name === 'string' ? '' : 0;
            } else {
                a = resolve(d.name);
            }
            arguments.push(a);
        }
        return makeReactive(new (window[name].bind.apply(window[name], arguments))());
    }

    var create = function (name, childNodes) {
        if (!(name in $this.components)) {
            throw new Error('Component ' + name + ' doesn\'t exist.');
        }
        var page = $this.components[name];
        var instance = resolve(name);
        console.log(instance);
        return build(page.nodes, instance, childNodes);
    };

    this.render = function (name) {
        if (!name) {
            throw new Error('Component name is required.');
        }
        if (!(name in this.components)) {
            throw new Error('Component ' + name + ' doesn\'t exist.');
        }
        nodes = create(name);
        // document.childNodes[1].remove();
        console.log(nodes);
        createDOM(document, nodes);
    };

    this.htmlentities = function (html) {
        return typeof html === 'string' ? html.replace(/[\u00A0-\u9999<>\&]/gim, function (i) {
            return '&#' + i.charCodeAt(0) + ';';
        }) : html;
    }
}
var app = new Edgeon();
app.start();
