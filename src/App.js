import React from 'react';
import Amplify from 'aws-amplify';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom'
import Image from './Image';
import Search from './Search';
import { withAuthenticator } from 'aws-amplify-react';

import aws_exports from './aws-exports';
Amplify.configure(aws_exports);

function App() {
  return (
    <Router forceRefresh={true}>
      <div>
        <Switch>
          <Route exact path="/" component={Search} />
          <Route path="/image/:imageid" component={Image} />
        </Switch>
      </div>
    </Router>
  );
}

export default withAuthenticator(App, {
  includeGreetings: true,
  signUpConfig: {
    hiddenDefaults: ['phone_number']
  }
}); 

