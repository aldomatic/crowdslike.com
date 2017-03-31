server "104.131.164.212", :user => "root", :roles => %{web app}
set :deploy_to, "/var/www/production/crowdslike.com"
set :branch, "master"

set :ssh_options, {
  forward_agent: true,
}

namespace :deploy do

    task :npm_install do
      on roles :all do
        execute "cd #{release_path} && npm install" 
      end
    end

    after :publishing, :npm_install

    task :restart do
      on roles :all do
        execute "cd #{release_path} && npm start"
      end
    end

    after :npm_install, :restart

end



