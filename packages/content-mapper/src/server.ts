import { stdin, stdout } from 'node:process';
import { serve } from './rpc.ts';

// TypeScript starts this file and sends each `.brm` file of a project to it.
serve(stdin, stdout);
