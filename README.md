Bujagali
========

A template system in JavaScript (kind of). Developed and currently in production
at Rdio.

Overview
--------

Bujagali is a flexible template system that is a thin layer on top of
JavaScript which makes it easier to write HTML (or any templated text)
using JavaScript. The syntax is modeled off of the Django templating system,
but the behavior is substantially different. It is not especially designer-
friendly.

The basic principle is to compile templates on the server-side to JS functions,
then load them lazily on the client to render JSON data.

This system is designed to work in either server-side or client-side JavaScript
environments. It depends on the excellent underscore library, so you can
reference `_` from anywhere in your templates.

There are 3 aspects to the system that require documentation.
    * Writing templates
    * Converting templates to JavaScript
    * Rendering templates


Writing Templates
-----------------

Every template is provided with a context variable, called `ctx`, that contains
the object the template was rendered with.

###Special Tags

There are two special tags that must come at the top of your templates. These
are used to reuse code found in other templates, and examples of their use is
given in the 'Regular Tags' section below

`#import <template path>`
This ensures that a template is rendered before rendering your template. This is
used to make sure that templates containing macros (described below) have been
loaded and are those macros are available to use by the time your template is
rendered. *Imports must be the first thing in a template.*

`#extends <template path>`
This tag includes the template you specify in the current template. These must
occur above all other markup, but *after `#import` tags*. This is used to provide
template inheritance, where the template being extended will later call into
the current template (see below for an example).

###Regular Tags

`{{ <data> }}` 
Output whatever is returned, usually a variable or the result of some operation.

Example:

    <h1>Name: {{ ctx.myName }}</h1>
    <h2>Address: {{ self.formatAddress(ctx.myName) }}</h2>
    <h3>Birth year: {{ 2010 - ctx.age }}</h3>

`{% <javascript> %}`
Execute the enclosed JavaScript, don't alter the markup in any way.

Example:

    {% if (ctx.fruits && ctx.fruits.length) {
        _.each(ctx.fruits, function(fruit) { %}
            <li>{{ fruit }}</li>
        {% });
    } %}

`{$ <block name> $}`
This is one part of how inheritance is done. This tag will define a block for a
subtemplate to override. This allows you to define where markup from a template
that extends the current template will be placed. This will call a function of
the name specified and output the result into the parent template.

Example:

Master template

    <html>
        <head>
            <title>{{ ctx.title }}</title>
            {$ scripts $}
            {$ css $}
        </head>
        <body>
            {$ content $}
        </body>
    </html>


Subtemplate

    #extends /relative/path/to/master/template

    {% function scripts() { %}
        <script type="text/javascript" src="/myprogram.js"></script>
    {% }
    function css() { %}
        <link type="text/css" rel="stylesheet" href="/mystyle.css" />
    {% }
    function content() { %}
        Hello World!
    } %}

`{= <macro name>(<macro arguments>) <macro content> =}`
This allows you to extend the template system and reuse pieces of templates in
other places.

Example:

In some template:

    {= render_address(address)
        <div class="address">
            <div class="street">{{ address.street }}</div>
            {% if (address.aptNum) { %}
                <div class="num">{{ address.aptNum }}</div>
            {% } %}
            <div class="line2">
                {{ address.city }}, {{ address.state }} {{ address.zip }}
            </div>
        </div>
    =}

Then in some other template:

    #import /relative/path/to/first/template

    <div class="address-list">
        {% _.each(ctx.addresses, function(address) { %}
            {{ self.render_address(address) }}
        {% } %}
    </div>

`{# <comment> #}`
Everything between these tags will be ignored and will not end up in the
compiled template.

###Advanced Concepts

#### `self`
`self` refers to the current instance of the template being rendered. You almost
always want to call macros and other functions provided by the templating system
with `self` (for the exceptions to this rule, see `this`). For instance, `escape`
is a function available to all templates in Bujagali.

    <h1>Name: {{ self.escape(ctx.name) }}</h1>

Macros defined by other templates are also available through self (so long as
you `#import` them first)

    #import /myheadertemplate.html

    <div class="header">{{ self.render_header(ctx) }}</div>

#### `emit`
`emit` is a function that is available to all templates. It is what is called
by the moustache tag (`{{ }}`). This can be useful for making some markup less
confusing.

Instead of

    The car is{% if (ctx.sex == 'female') { %} hers.{% } else { %} his.{% } %}

You could do

    The car is{% ctx.sex == 'female' ? emit(' hers.') : emit(' his.'); %}

This example is a little contrived as you could also do

    The car is{{ ctx.sex == 'female' ? ' hers.' : ' his.' }}

But it does come in useful sometimes, I swear.

#### `this`
`this` is confusing, I'm sorry. Sometimes you don't want to `emit` markup into
your own context, sometimes you want to `emit` it into your caller's context.
This happens in macros, for instance, where the markup of the macro itself
doesn't matter and you want to alter the markup of the caller. In this case,
`self` is useless as it refers to your own template. I think of `self` as the
template I'm looking at and `this` as the context I'm modifying.

For example, in a macro calling another macro:

    {= macro1()
        <p>A very long story.</p>
    =}

    {= macro2(title)
        <h1>{{ title }}</h1>
        {{ this.macro1() }}
    =}

    {# off in another file... #}
    {{ self.macro2(); }}

In this example, `macro1` ends up modifying the `self` that calls `macro2`
because `macro2` called `macro1` using `this`. If it had used `self`, it
would have modified the wrong context.

I hope that's not too confusing.

###Provided functions
See the [API docs](http://rdio.github.com/bujagali/js-api) for what functions are available to you from your templates
and how to extend that set.
