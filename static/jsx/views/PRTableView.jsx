define([
    'react',
    'react-mini-router',
    'jquery',
    'underscore',
    'marked',
    'views/TableView',
    'bootstrap',
    'jquery-timeago'
  ],
  function(React, Router, $, _, marked, TableView) {
    "use strict";

    var jenkinsOutcomes = {
      Pass: {label: "Passed", iconName: "ok"},
      Fail: {label: "Failed", iconName: "remove"},
      Timeout: {label: "Timed out", iconName: "time"},
      Running: {label: "Running", iconName: "arrow-right"},
      Verify: {label: "Admin needed", iconName: "comment"},
      Asked: {label: "Asked to test", iconName: "comment"},
      Unknown: {label: "Unknown", iconName: "question-sign"}
    };

    var JIRALink = React.createClass({
      render: function() {
        var link = "http://issues.apache.org/jira/browse/SPARK-" + this.props.number;
        return (
          <a className="jira-link" href={link} target="_blank">
            {this.props.number}
          </a>
        );
      }
    });

    var Commenter = React.createClass({
      componentDidMount: function() {
        $(this.refs.commenter.getDOMNode()).popover();
      },

      render: function() {
        var comment = this.props.comment;
        var username = this.props.username;
        var commenterClass = "commenter commenter-icon";

        if (comment.said_lgtm) {
          commenterClass += " lgtm";
        } else if (comment.asked_to_close) {
          commenterClass += " asked-to-close";
        }

        var title = "<a href='" + comment.url + "'>Comment</a> from <a href='/users/" +
          username + "'>" + username + "</a>";
        var content = marked(comment.body);

        return (
          <img ref="commenter" tabIndex="0" className={commenterClass}
            src={comment.avatar + "&s=16"} alt={username} data-toggle="popover"
            data-trigger="focus" data-placement="left" data-html="true"
            data-title={title} data-content={content}/>
        );
      }
    });

    var TestWithJenkinsButton = React.createClass({
      onClick: function() {
        var prNum = this.props.pr.number;
        var shouldTest = confirm("Are you sure you want to test PR " + prNum + " with Jenkins?");
        if (shouldTest) {
          window.open('/trigger-jenkins/' + prNum, '_blank');
        }
      },
      render: function() {
        return (
          <button
            onClick={this.onClick}
            className="btn btn-default btn-xs">
            <span className="glyphicon glyphicon-refresh"></span>
            Test with Jenkins
          </button>
        );
      }
    });

    var PRTableRow = React.createClass({
      componentDidMount: function() {
        if (this.refs.jenkinsPopover !== undefined) {
          $(this.refs.jenkinsPopover.getDOMNode()).popover();
        }
      },

      render: function() {
        var pr = this.props.pr;
        var jiraLinks = _.map(pr.parsed_title.jiras, function(number) {
          return (<JIRALink key={number} number={number}/>);
        });

        var commenters = _.map(pr.commenters, function(comment) {
          return (
            <Commenter
              key={comment.data.date}
              username={comment.username}
              comment={comment.data}/>
          );
        });

        var mergeIcon = (pr.is_mergeable ?
          <i className="glyphicon glyphicon-ok"></i> :
          <i className="glyphicon glyphicon-remove"></i>);

        var pullLink = "https://www.github.com/apache/spark/pull/" + pr.number;

        var jenkinsOutcome = jenkinsOutcomes[pr.last_jenkins_outcome];
        var iconClass = "glyphicon glyphicon-" + jenkinsOutcome.iconName;

        var jenkinsCell;
        var lastJenkinsComment = pr.last_jenkins_comment;
        if (lastJenkinsComment) {
          var username = lastJenkinsComment.user.login;
          var title = "<a href='" + lastJenkinsComment.html_url + "'>Comment</a> from " +
            "<a href='/users/" + username + "'>" + username + "</a>";
          var content = marked(lastJenkinsComment.body);

          jenkinsCell = (
            <span ref="jenkinsPopover" tabIndex="0"
              data-toggle="popover" data-trigger="focus"
              data-placement="left" data-html="true"
              data-title={title} data-content={content}>
              <i className={iconClass}></i>
              <span className="jenkins-outcome-link">
                {jenkinsOutcome.label}
              </span>
            </span>
          );
        } else {
          jenkinsCell = (
            <div>
              <i className={iconClass}></i>
              {jenkinsOutcome.label}
            </div>
          );
        }

        var updatedAt = $.timeago(pr.updated_at + "Z");
        var updatedCell = <abbr title={pr.updated_at}>{updatedAt}</abbr>;
        var toolsCell =
          <td>
            <TestWithJenkinsButton pr={pr}/>
          </td>;
        return (
          <tr>
            <td>
              <a href={pullLink} target="_blank">
              {pr.number}
              </a>
            </td>
            <td>{jiraLinks}</td>
            <td>
              <a href={pullLink} target="_blank">
                {pr.parsed_title.metadata + pr.parsed_title.title}
              </a>
            </td>
            <td>
              <a href={"/users/" + pr.user}>
                {pr.user}
              </a>
            </td>
            <td>
              {commenters}
            </td>
            <td>
              <span className="lines-added">+{pr.lines_added}</span>
              <span className="lines-deleted">-{pr.lines_deleted}</span>
            </td>
            <td>
              {mergeIcon}
            </td>
            <td>
              {jenkinsCell}
            </td>
            <td>
              {updatedCell}
            </td>
            {this.props.showJenkinsButtons ? toolsCell : ""}
          </tr>
        );
      }
    });

    var PRTableView = React.createClass({
      propTypes: {
        prs: React.PropTypes.array.isRequired
      },

      sortFunctions: {
        'Number': function(row) { return row.props.pr.number; },
        'JIRAs': function(row) { return row.props.pr.parsed_title.jiras; },
        'Title': function(row) { return row.props.pr.parsed_title.title.toLowerCase(); },
        'Author': function(row) { return row.props.pr.user.toLowerCase(); },
        'Commenters': function(row) { return row.props.pr.commenters.length; },
        'Changes': function(row) { return row.props.pr.lines_changed; },
        'Merges': function(row) { return row.props.pr.is_mergeable; },
        'Jenkins': function(row) { return row.props.pr.last_jenkins_outcome; },
        'Updated': function(row) { return row.props.pr.updated_at; }
      },

      columnNames: function() {
        var columNames = [
          "Number",
          "JIRAs",
          "Title",
          "Author",
          "Commenters",
          "Changes",
          "Merges",
          "Jenkins",
          "Updated"
        ];
        if (this.props.showJenkinsButtons) {
          columNames.push("Tools");
        }
        return columNames;
      },

      render: function() {
        var _this = this;
        var tableRows = _.map(this.props.prs, function(pr) {
          return (
            <PRTableRow
              key={pr.number}
              pr={pr}
              showJenkinsButtons={_this.props.showJenkinsButtons}/>
          );
        });

        return (
          <TableView
            rows={tableRows}
            columnNames={this.columnNames()}
            sortFunctions={this.sortFunctions}/>
        );
      }
    });

    return PRTableView;
  }
);
