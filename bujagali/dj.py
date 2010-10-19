"""
Utilities that help Bujagali work in a django environment
"""

def serialize_form(form):
  """
  Take a django form and serialize it
  """
  serialized_form = {'fields': []}
  for field in form:
    serialized_form[field.name] = {
      'html': str(field),
      'errors': [str(e) for e in field.errors],
      'label': field.label
    }
    serialized_form['fields'].append(field.name)
  serialized_form['non_field_errors'] = [str(e) for e in form.non_field_errors()]

  return serialized_form

