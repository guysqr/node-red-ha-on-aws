import boto3
from string import Template

client = boto3.client('elasticbeanstalk')

print ("Reading input file eb-with-efs.yaml")

f = open('eb-with-efs.yaml', 'r')

s = Template(f.read())

print ("Adding solution stacks")

ebstackblock = """Check AWS docs for available platform descriptions. Make sure your
      application is compatible with the selected platform.
    ConstraintDescription: Invalid runtime environment value
    AllowedValues: 
      -  """ + '\n      -  '.join(client.list_available_solution_stacks()['SolutionStacks'])

response = s.substitute(ebstack=ebstackblock)

o = open('eb-with-efs-out.yaml','w+')
o.write(response)

print ("Stacks written to eb-with-efs-out.yaml")